import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  AlertTriangle,
  Database,
  Mail,
  Download
} from "lucide-react";

interface UserImportWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedUser {
  email: string;
  display_name?: string;
  mobile_number?: string;
  country?: string;
  password?: string;
  avatar_url?: string;
  is_subscribed?: boolean;
}

interface ColumnMapping {
  email: string;
  display_name: string;
  mobile_number: string;
  country: string;
  password: string;
  avatar_url: string;
  is_subscribed: string;
  first_name: string;
  last_name: string;
}

interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

type WizardStep = "upload" | "mapping" | "options" | "progress" | "complete";

export const UserImportWizard = ({ onClose, onSuccess }: UserImportWizardProps) => {
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileData, setFileData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    email: "",
    display_name: "",
    mobile_number: "",
    country: "",
    password: "",
    avatar_url: "",
    is_subscribed: "",
    first_name: "",
    last_name: ""
  });
  const [options, setOptions] = useState({
    skipDuplicates: true,
    sendWelcomeEmail: false,
    requirePasswordReset: true,
    dryRun: false,
    useDefaultCredentials: true,
    defaultPin: "123456",
    defaultPassword: "Pa55w0rd",
    defaultSecretWord: "hoyeeh2024"
  });
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const parseJSON = (text: string): string[][] => {
    try {
      const data = JSON.parse(text);
      const array = Array.isArray(data) ? data : data.data || data.users || data.records || [];
      if (array.length === 0) return [];
      
      const headers = Object.keys(array[0]);
      const rows = array.map((item: Record<string, unknown>) => 
        headers.map(h => String(item[h] ?? ""))
      );
      return [headers, ...rows];
    } catch {
      throw new Error("Invalid JSON format");
    }
  };

  // Parse SQL INSERT statements from MySQL/phpMyAdmin dump
  const parseSQL = (text: string): string[][] => {
    const results: string[][] = [];
    let headers: string[] = [];
    
    // Match INSERT INTO statements with column names
    const insertRegex = /INSERT\s+INTO\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)\s*VALUES\s*/gi;
    const valueBlockRegex = /\(([^)]+)\)/g;
    
    // Find all INSERT statements
    const lines = text.split(';');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.toUpperCase().includes('INSERT INTO')) continue;
      
      // Extract column names from first INSERT statement
      const headerMatch = insertRegex.exec(trimmedLine);
      insertRegex.lastIndex = 0; // Reset regex
      
      if (headerMatch && headers.length === 0) {
        headers = headerMatch[2]
          .split(',')
          .map(h => h.trim().replace(/[`"]/g, ''));
      }
      
      // Extract values
      let valuesMatch;
      const valuesStart = trimmedLine.toUpperCase().indexOf('VALUES');
      if (valuesStart === -1) continue;
      
      const valuesPart = trimmedLine.slice(valuesStart + 6);
      
      while ((valuesMatch = valueBlockRegex.exec(valuesPart)) !== null) {
        const values = parseValueString(valuesMatch[1]);
        if (values.length > 0) {
          results.push(values);
        }
      }
    }
    
    if (headers.length === 0 && results.length > 0) {
      // Generate generic headers if none found
      headers = results[0].map((_, i) => `column_${i + 1}`);
    }
    
    if (results.length === 0) {
      throw new Error("No valid INSERT statements found in SQL file");
    }
    
    return [headers, ...results];
  };

  // Parse a value string from SQL, handling quotes and escapes
  const parseValueString = (valueStr: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inString = false;
    let stringChar = "";
    let i = 0;
    
    while (i < valueStr.length) {
      const char = valueStr[i];
      
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }
      
      if (inString && char === stringChar) {
        // Check for escaped quote
        if (i + 1 < valueStr.length && valueStr[i + 1] === stringChar) {
          current += char;
          i += 2;
          continue;
        }
        inString = false;
        i++;
        continue;
      }
      
      if (!inString && char === ',') {
        values.push(current.trim().replace(/^NULL$/i, ''));
        current = "";
        i++;
        continue;
      }
      
      if (inString || (char !== ' ' && char !== '\t' && char !== '\n')) {
        current += char;
      }
      i++;
    }
    
    values.push(current.trim().replace(/^NULL$/i, ''));
    return values;
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB for SQL files
    if (file.size > maxSize) {
      toast.error("File size exceeds 10MB limit");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: string[][];

        if (file.name.endsWith('.json')) {
          parsed = parseJSON(text);
        } else if (file.name.endsWith('.sql')) {
          parsed = parseSQL(text);
        } else {
          parsed = parseCSV(text);
        }

        if (parsed.length < 2) {
          toast.error("File must contain headers and at least one data row");
          return;
        }

        setHeaders(parsed[0]);
        setFileData(parsed.slice(1));

        // Auto-detect column mappings
        const lowerHeaders = parsed[0].map(h => h.toLowerCase());
        const newMapping = { ...columnMapping };
        
        const emailPatterns = ['email', 'e-mail', 'email_address', 'user_email'];
        const namePatterns = ['name', 'display_name', 'displayname', 'username', 'user_name', 'full_name'];
        const firstNamePatterns = ['first_name', 'firstname', 'fname'];
        const lastNamePatterns = ['last_name', 'lastname', 'lname'];
        const phonePatterns = ['phone', 'mobile', 'mobile_number', 'phone_number', 'telephone'];
        const countryPatterns = ['country', 'location', 'region', 'address'];
        const passwordPatterns = ['password', 'pass', 'pwd', 'password_hash'];
        const avatarPatterns = ['avatar', 'avatar_url', 'file_url', 'profile_image', 'photo'];
        const subscribePatterns = ['is_subscribe', 'is_subscribed', 'subscribed', 'subscription'];

        lowerHeaders.forEach((h, i) => {
          if (emailPatterns.some(p => h.includes(p))) newMapping.email = parsed[0][i];
          if (namePatterns.some(p => h.includes(p)) && !firstNamePatterns.some(p => h.includes(p)) && !lastNamePatterns.some(p => h.includes(p))) {
            newMapping.display_name = parsed[0][i];
          }
          if (firstNamePatterns.some(p => h.includes(p))) newMapping.first_name = parsed[0][i];
          if (lastNamePatterns.some(p => h.includes(p))) newMapping.last_name = parsed[0][i];
          if (phonePatterns.some(p => h.includes(p))) newMapping.mobile_number = parsed[0][i];
          if (countryPatterns.some(p => h.includes(p))) newMapping.country = parsed[0][i];
          if (passwordPatterns.some(p => h.includes(p))) newMapping.password = parsed[0][i];
          if (avatarPatterns.some(p => h.includes(p))) newMapping.avatar_url = parsed[0][i];
          if (subscribePatterns.some(p => h.includes(p))) newMapping.is_subscribed = parsed[0][i];
        });

        setColumnMapping(newMapping);
        const fileType = file.name.endsWith('.sql') ? 'SQL dump' : file.name.endsWith('.json') ? 'JSON' : 'CSV';
        toast.success(`Loaded ${parsed.length - 1} records from ${fileType} file`);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to parse file");
      }
    };

    reader.readAsText(file);
  }, [columnMapping]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const input = document.createElement('input');
      input.type = 'file';
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileUpload({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const getValueByMapping = (row: string[], header: string): string => {
    if (!header || header === "__none__") return "";
    const index = headers.indexOf(header);
    return index >= 0 ? (row[index] || "") : "";
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleImport = async () => {
    if (!columnMapping.email) {
      toast.error("Email column mapping is required");
      return;
    }

    setIsImporting(true);
    setStep("progress");
    setProgress(0);

    const importResult: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const users: ParsedUser[] = fileData.map(row => {
      const firstName = columnMapping.first_name ? getValueByMapping(row, columnMapping.first_name) : "";
      const lastName = columnMapping.last_name ? getValueByMapping(row, columnMapping.last_name) : "";
      let displayName = columnMapping.display_name ? getValueByMapping(row, columnMapping.display_name) : undefined;
      
      // Combine first_name + last_name if display_name is not mapped
      if (!displayName && (firstName || lastName)) {
        displayName = `${firstName} ${lastName}`.trim();
      }

      // Parse is_subscribed from string to boolean
      const isSubscribedValue = columnMapping.is_subscribed ? getValueByMapping(row, columnMapping.is_subscribed) : "";
      const isSubscribed = isSubscribedValue === "1" || isSubscribedValue.toLowerCase() === "true" || isSubscribedValue.toLowerCase() === "yes";

      return {
        email: getValueByMapping(row, columnMapping.email),
        display_name: displayName,
        mobile_number: columnMapping.mobile_number ? getValueByMapping(row, columnMapping.mobile_number) : undefined,
        country: columnMapping.country ? getValueByMapping(row, columnMapping.country) : undefined,
        password: columnMapping.password ? getValueByMapping(row, columnMapping.password) : undefined,
        avatar_url: columnMapping.avatar_url ? getValueByMapping(row, columnMapping.avatar_url) : undefined,
        is_subscribed: columnMapping.is_subscribed ? isSubscribed : undefined
      };
    }).filter(u => u.email);

    const batchSize = 10;
    const batches = Math.ceil(users.length / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, users.length);
      const batchUsers = users.slice(start, end);

      for (let i = 0; i < batchUsers.length; i++) {
        const user = batchUsers[i];
        const rowNum = start + i + 2; // +2 for header and 1-based index

        try {
          if (!validateEmail(user.email)) {
            importResult.failed++;
            importResult.errors.push({ row: rowNum, email: user.email, error: "Invalid email format" });
            continue;
          }

          if (options.dryRun) {
            importResult.success++;
            continue;
          }

          // Call edge function to import user
          const { data, error } = await supabase.functions.invoke('import-users-mysql', {
            body: {
              user,
              options: {
                skipDuplicates: options.skipDuplicates,
                sendWelcomeEmail: options.sendWelcomeEmail,
                requirePasswordReset: options.requirePasswordReset,
                defaultPin: options.useDefaultCredentials ? options.defaultPin : undefined,
                defaultPassword: options.useDefaultCredentials ? options.defaultPassword : undefined,
                defaultSecretWord: options.useDefaultCredentials ? options.defaultSecretWord : undefined
              }
            }
          });

          if (error) throw error;

          if (data?.skipped) {
            importResult.skipped++;
          } else if (data?.success) {
            importResult.success++;
          } else {
            importResult.failed++;
            importResult.errors.push({ row: rowNum, email: user.email, error: data?.error || "Unknown error" });
          }
        } catch (error: unknown) {
          importResult.failed++;
          importResult.errors.push({ 
            row: rowNum, 
            email: user.email, 
            error: error instanceof Error ? error.message : "Import failed" 
          });
        }
      }

      setProgress(Math.round((end / users.length) * 100));
    }

    setResult(importResult);
    setStep("complete");
    setIsImporting(false);

    if (importResult.success > 0 && !options.dryRun) {
      toast.success(`Successfully imported ${importResult.success} users`);
    }
  };

  const downloadErrorLog = () => {
    if (!result?.errors.length) return;
    
    const csv = [
      ['Row', 'Email', 'Error'],
      ...result.errors.map(e => [e.row.toString(), e.email, e.error])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">Drag & drop your file here</p>
        <p className="text-sm text-muted-foreground mb-4">
          Supports CSV, JSON, and SQL exports from phpMyAdmin/MySQL
        </p>
        <Input
          id="file-upload"
          type="file"
          accept=".csv,.json,.sql"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button variant="outline" type="button">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Browse Files
        </Button>
      </div>

      {fileName && (
        <Card className="bg-secondary/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {fileData.length} records found, {headers.length} columns
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setFileName("");
                  setFileData([]);
                  setHeaders([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {fileData.length > 0 && (
        <div className="space-y-2">
          <Label>Preview (first 5 rows)</Label>
          <ScrollArea className="h-40 rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 whitespace-nowrap">
                        {cell || <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
        <p className="text-sm font-medium">Map your columns to database fields</p>
        <p className="text-xs text-muted-foreground mt-1">
          Email is required. Use first_name + last_name if display_name is not available.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'email', label: 'Email Address', required: true },
          { key: 'display_name', label: 'Display Name', required: false },
          { key: 'first_name', label: 'First Name', required: false },
          { key: 'last_name', label: 'Last Name', required: false },
          { key: 'mobile_number', label: 'Phone Number', required: false },
          { key: 'country', label: 'Country/Address', required: false },
          { key: 'avatar_url', label: 'Avatar URL', required: false },
          { key: 'is_subscribed', label: 'Is Subscribed', required: false },
          { key: 'password', label: 'Password (optional)', required: false }
        ].map(({ key, label, required }) => (
          <div key={key} className="space-y-2">
            <Label className="flex items-center gap-2">
              {label}
              {required && <Badge variant="destructive" className="text-xs">Required</Badge>}
            </Label>
            <Select
              value={columnMapping[key as keyof ColumnMapping] || "__none__"}
              onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [key]: value === "__none__" ? "" : value }))}
            >
              <SelectTrigger className="bg-secondary">
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- None --</SelectItem>
                {headers.map((h, idx) => (
                  <SelectItem key={`${h}-${idx}`} value={h || `column_${idx}`}>{h || `Column ${idx + 1}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );

  const renderOptionsStep = () => (
    <div className="space-y-6">
      {/* Default Credentials Section */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Default Credentials for Imported Users
          </CardTitle>
          <CardDescription>
            Set default PIN and password for all imported users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="useDefaultCredentials"
              checked={options.useDefaultCredentials}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, useDefaultCredentials: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor="useDefaultCredentials" className="cursor-pointer font-medium">
                Use default credentials
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                All imported users will receive the same PIN and password below
              </p>
            </div>
          </div>
          
          {options.useDefaultCredentials && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="defaultPin">Default PIN (6 digits)</Label>
                <Input
                  id="defaultPin"
                  value={options.defaultPin}
                  onChange={(e) => setOptions(prev => ({ ...prev, defaultPin: e.target.value }))}
                  placeholder="123456"
                  maxLength={6}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultPassword">Default Password</Label>
                <Input
                  id="defaultPassword"
                  value={options.defaultPassword}
                  onChange={(e) => setOptions(prev => ({ ...prev, defaultPassword: e.target.value }))}
                  placeholder="Pa55w0rd"
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultSecretWord">Default Secret Word</Label>
                <Input
                  id="defaultSecretWord"
                  value={options.defaultSecretWord}
                  onChange={(e) => setOptions(prev => ({ ...prev, defaultSecretWord: e.target.value }))}
                  placeholder="hoyeeh2024"
                  className="bg-secondary"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Options */}
      <div className="space-y-4">
        {[
          {
            id: 'skipDuplicates',
            label: 'Skip duplicate emails',
            description: 'Users with emails that already exist will be skipped'
          },
          {
            id: 'sendWelcomeEmail',
            label: 'Send welcome email',
            description: 'New users will receive a welcome email with their login details'
          },
          {
            id: 'requirePasswordReset',
            label: 'Require password reset',
            description: 'Users must set a new password on first login'
          },
          {
            id: 'dryRun',
            label: 'Dry run (test only)',
            description: 'Validate data without actually importing users'
          }
        ].map(({ id, label, description }) => (
          <div key={id} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors">
            <Checkbox
              id={id}
              checked={options[id as 'skipDuplicates' | 'sendWelcomeEmail' | 'requirePasswordReset' | 'dryRun']}
              onCheckedChange={(checked) => 
                setOptions(prev => ({ ...prev, [id]: checked === true }))
              }
            />
            <div className="flex-1">
              <Label htmlFor={id} className="cursor-pointer font-medium">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <Card className="bg-secondary/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Ready to import {fileData.length} users</p>
              <p className="text-sm text-muted-foreground">
                {options.dryRun ? "This is a test run - no data will be modified" : 
                  options.useDefaultCredentials ? 
                    `Users will be created with PIN: ${options.defaultPin}, Password: ${options.defaultPassword}` :
                    "Users will be created in the database"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProgressStep = () => (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Upload className="h-8 w-8 text-primary animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {options.dryRun ? "Validating users..." : "Importing users..."}
        </h3>
        <p className="text-muted-foreground">Please don't close this window</p>
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-center text-muted-foreground">{progress}% complete</p>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
          result?.failed === 0 ? 'bg-green-500/10' : 'bg-yellow-500/10'
        }`}>
          {result?.failed === 0 ? (
            <Check className="h-8 w-8 text-green-500" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {options.dryRun ? "Validation Complete" : "Import Complete"}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{result?.success || 0}</p>
            <p className="text-sm text-muted-foreground">Successful</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{result?.skipped || 0}</p>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{result?.failed || 0}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {result?.errors && result.errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Error Log</Label>
            <Button variant="ghost" size="sm" onClick={downloadErrorLog}>
              <Download className="h-4 w-4 mr-1" />
              Download CSV
            </Button>
          </div>
          <ScrollArea className="h-32 rounded-md border">
            <div className="p-3 space-y-2">
              {result.errors.slice(0, 10).map((err, i) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  <Badge variant="destructive" className="text-xs">Row {err.row}</Badge>
                  <span className="text-muted-foreground">{err.email}:</span>
                  <span className="text-destructive">{err.error}</span>
                </div>
              ))}
              {result.errors.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  ... and {result.errors.length - 10} more errors
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  const canProceed = () => {
    switch (step) {
      case "upload": return fileData.length > 0;
      case "mapping": return !!columnMapping.email;
      case "options": return true;
      default: return false;
    }
  };

  const handleNext = () => {
    switch (step) {
      case "upload": setStep("mapping"); break;
      case "mapping": setStep("options"); break;
      case "options": handleImport(); break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case "mapping": setStep("upload"); break;
      case "options": setStep("mapping"); break;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Users from MySQL/phpMyAdmin
          </DialogTitle>
          <DialogDescription>
            Import user data from CSV, JSON, or SQL exports from your MySQL database.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {['upload', 'mapping', 'options', 'progress', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : ['complete', 'progress'].indexOf(step) > ['complete', 'progress'].indexOf(s) ||
                    ['upload', 'mapping', 'options'].indexOf(s) < ['upload', 'mapping', 'options'].indexOf(step)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 4 && <div className="w-8 h-0.5 bg-border mx-1" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === "upload" && renderUploadStep()}
        {step === "mapping" && renderMappingStep()}
        {step === "options" && renderOptionsStep()}
        {step === "progress" && renderProgressStep()}
        {step === "complete" && renderCompleteStep()}

        {/* Footer Actions */}
        <div className="flex justify-between pt-4 border-t">
          {step === "complete" ? (
            <>
              <Button variant="outline" onClick={onClose}>Close</Button>
              {!options.dryRun && result?.success && result.success > 0 && (
                <Button onClick={onSuccess}>View Users</Button>
              )}
            </>
          ) : step === "progress" ? (
            <div className="flex-1" />
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={step === "upload" ? onClose : handleBack}
              >
                {step === "upload" ? (
                  "Cancel"
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </>
                )}
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isImporting}
              >
                {step === "options" ? (
                  options.dryRun ? "Validate" : "Start Import"
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
