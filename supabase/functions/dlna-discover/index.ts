import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSDP M-SEARCH message for UPnP MediaRenderer discovery
const SSDP_SEARCH = `M-SEARCH * HTTP/1.1\r
HOST: 239.255.255.250:1900\r
MAN: "ssdp:discover"\r
MX: 3\r
ST: urn:schemas-upnp-org:device:MediaRenderer:1\r
\r
`;

interface DLNADevice {
  id: string;
  name: string;
  type: 'dlna' | 'upnp';
  location: string;
  manufacturer?: string;
  modelName?: string;
  controlUrl?: string;
}

// Parse SSDP response headers
function parseSSDPResponse(response: string): { location?: string; st?: string; usn?: string } {
  const headers: Record<string, string> = {};
  const lines = response.split('\r\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers[key] = value;
    }
  }
  
  return {
    location: headers['location'],
    st: headers['st'],
    usn: headers['usn'],
  };
}

// Fetch and parse device description XML
async function fetchDeviceDescription(locationUrl: string): Promise<Partial<DLNADevice> | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(locationUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const xml = await response.text();
    
    // Simple XML parsing for device info
    const getName = (tag: string) => {
      const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
      return match ? match[1] : undefined;
    };
    
    const getControlUrl = () => {
      // Look for AVTransport control URL
      const serviceMatch = xml.match(/<serviceType>urn:schemas-upnp-org:service:AVTransport:1<\/serviceType>[\s\S]*?<controlURL>([^<]+)<\/controlURL>/);
      if (serviceMatch) {
        let controlUrl = serviceMatch[1];
        // Make absolute URL if relative
        if (!controlUrl.startsWith('http')) {
          const baseUrl = new URL(locationUrl);
          controlUrl = `${baseUrl.origin}${controlUrl.startsWith('/') ? '' : '/'}${controlUrl}`;
        }
        return controlUrl;
      }
      return undefined;
    };
    
    return {
      name: getName('friendlyName') || 'Unknown Device',
      manufacturer: getName('manufacturer'),
      modelName: getName('modelName'),
      controlUrl: getControlUrl(),
    };
  } catch (error) {
    console.error('Failed to fetch device description:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, deviceControlUrl, mediaUrl, mediaTitle } = await req.json();
    
    if (action === 'discover') {
      console.log('Starting DLNA device discovery...');
      
      // Note: True SSDP discovery requires UDP multicast which isn't available in edge functions
      // This endpoint serves as a bridge - in production, you'd run a local discovery service
      // or use a pre-configured list of known devices
      
      // For demonstration, we return instructions for manual device configuration
      // In production, you could:
      // 1. Have users manually add device IPs
      // 2. Run a companion app on the local network that performs discovery
      // 3. Use mDNS/Bonjour if the platform supports it
      
      return new Response(JSON.stringify({
        success: true,
        devices: [],
        message: 'DLNA discovery requires local network access. Please add devices manually or use the companion app.',
        manualSetup: {
          instructions: [
            '1. Find your TV\'s IP address in its network settings',
            '2. Enable DLNA/UPnP in your TV\'s settings',
            '3. Add the device manually using the IP address',
          ],
          commonPorts: [49152, 8008, 8080, 1900],
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'play' && deviceControlUrl && mediaUrl) {
      console.log('Playing media on DLNA device:', deviceControlUrl);
      
      // SOAP request for SetAVTransportURI
      const setTransportUri = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${escapeXml(mediaUrl)}</CurrentURI>
      <CurrentURIMetaData>
        &lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;
          &lt;item id="0" parentID="-1" restricted="false"&gt;
            &lt;dc:title&gt;${escapeXml(mediaTitle || 'Video')}&lt;/dc:title&gt;
            &lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;
            &lt;res protocolInfo="http-get:*:video/mp4:*"&gt;${escapeXml(mediaUrl)}&lt;/res&gt;
          &lt;/item&gt;
        &lt;/DIDL-Lite&gt;
      </CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;

      try {
        // Set the media URL
        const setUriResponse = await fetch(deviceControlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
          },
          body: setTransportUri,
        });
        
        if (!setUriResponse.ok) {
          throw new Error(`SetAVTransportURI failed: ${setUriResponse.status}`);
        }
        
        // Send Play command
        const playCommand = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>`;

        const playResponse = await fetch(deviceControlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
          },
          body: playCommand,
        });
        
        if (!playResponse.ok) {
          throw new Error(`Play command failed: ${playResponse.status}`);
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('DLNA playback error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Playback failed' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    if (action === 'control' && deviceControlUrl) {
      const { command, seekTime } = await req.json();
      
      let soapAction = '';
      let soapBody = '';
      
      switch (command) {
        case 'pause':
          soapAction = 'Pause';
          soapBody = `<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Pause>`;
          break;
        case 'play':
          soapAction = 'Play';
          soapBody = `<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>`;
          break;
        case 'stop':
          soapAction = 'Stop';
          soapBody = `<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Stop>`;
          break;
        case 'seek':
          soapAction = 'Seek';
          const time = formatDLNATime(seekTime || 0);
          soapBody = `<u:Seek xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Unit>REL_TIME</Unit><Target>${time}</Target></u:Seek>`;
          break;
        default:
          return new Response(JSON.stringify({ success: false, error: 'Unknown command' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
      }
      
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    ${soapBody}
  </s:Body>
</s:Envelope>`;

      try {
        const response = await fetch(deviceControlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction': `"urn:schemas-upnp-org:service:AVTransport:1#${soapAction}"`,
          },
          body: soapEnvelope,
        });
        
        return new Response(JSON.stringify({ success: response.ok }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('DLNA control error:', error);
        return new Response(JSON.stringify({ success: false }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('DLNA function error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDLNATime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
