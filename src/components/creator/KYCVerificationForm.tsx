import { useState } from "react";
import { useCreatorKYC, useSubmitKYC, useUploadKYCDocument } from "@/hooks/useCreatorKYC";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Shield, CheckCircle, XCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function KYCVerificationForm() {
  const { data: existingKYC, isLoading } = useCreatorKYC();
  const submitKYC = useSubmitKYC();
  const uploadDocument = useUploadKYCDocument();
  
  const [formData, setFormData] = useState({
    full_name: existingKYC?.full_name || '',
    date_of_birth: existingKYC?.date_of_birth || '',
    nationality: existingKYC?.nationality || '',
    email: existingKYC?.email || '',
    phone_number: existingKYC?.phone_number || '',
    address_line1: existingKYC?.address_line1 || '',
    address_city: existingKYC?.address_city || '',
    address_country: existingKYC?.address_country || '',
    id_type: (existingKYC?.id_type as 'national_id' | 'drivers_license' | 'passport') || 'national_id',
    id_number: existingKYC?.id_number || '',
    id_document_url: existingKYC?.id_document_url || '',
    id_expiry_date: existingKYC?.id_expiry_date || '',
  });

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadDocument.mutateAsync(file);
      setFormData(prev => ({ ...prev, id_document_url: url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitKYC.mutateAsync(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show status if already submitted
  if (existingKYC?.status === 'approved') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-500">
            <CheckCircle className="h-8 w-8" />
            <div>
              <h3 className="font-semibold text-lg">KYC Verified</h3>
              <p className="text-sm text-muted-foreground">Your identity has been verified. You can now request payouts.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (existingKYC?.status === 'pending') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-yellow-500">
            <Clock className="h-8 w-8" />
            <div>
              <h3 className="font-semibold text-lg">Verification Pending</h3>
              <p className="text-sm text-muted-foreground">Your documents are under review. This usually takes 1-2 business days.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Identity Verification (KYC)
        </CardTitle>
        <CardDescription>
          Complete your identity verification to enable payouts. Your information is securely stored and encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existingKYC?.status === 'declined' && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Verification Declined:</strong> {existingKYC.rejection_reason || 'Please resubmit with valid documents.'}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h4 className="font-medium">Personal Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Legal Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="As shown on your ID"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input
                  value={formData.nationality}
                  onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                  placeholder="e.g., Cameroonian"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="font-medium">Contact Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  value={formData.phone_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                  placeholder="+237..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="font-medium">Address</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={formData.address_line1}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line1: e.target.value }))}
                  placeholder="Street address"
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.address_city}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_city: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={formData.address_country}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_country: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* ID Document */}
          <div className="space-y-4">
            <h4 className="font-medium">Identity Document</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID Type *</Label>
                <Select 
                  value={formData.id_type} 
                  onValueChange={(value: 'national_id' | 'drivers_license' | 'passport') => 
                    setFormData(prev => ({ ...prev, id_type: value }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID Card</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ID Number *</Label>
                <Input
                  value={formData.id_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_number: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>ID Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.id_expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, id_expiry_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Upload ID Document *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="id-document"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('id-document')?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {formData.id_document_url ? 'Change Document' : 'Upload Document'}
                  </Button>
                </div>
                {formData.id_document_url && (
                  <p className="text-xs text-green-500">Document uploaded successfully</p>
                )}
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={submitKYC.isPending || !formData.id_document_url}
            className="w-full"
          >
            {submitKYC.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit for Verification
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
