'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-provider'
import { twoFactor } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react'
import QRCode from 'react-qr-code'

type SetupStep = 'idle' | 'password' | 'qr' | 'verify' | 'backup'

export function TwoFactorSettings(): React.JSX.Element {
  const { user, refreshSession } = useAuth()
  const [isEnabled, setIsEnabled] = useState(user?.twoFactorEnabled ?? false)

  // Setup flow state
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [password, setPassword] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Disable flow state
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [isDisabling, setIsDisabling] = useState(false)

  const handleStartSetup = (): void => {
    setSetupStep('password')
    setPassword('')
    setError('')
  }

  const handlePasswordSubmit = async (): Promise<void> => {
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Enable 2FA
      const { error: enableError } = await twoFactor.enable({
        password,
      })

      if (enableError) {
        setError(enableError.message || 'Failed to enable 2FA')
        setIsLoading(false)
        return
      }

      // Get TOTP URI for QR code
      const { data: totpData, error: totpError } = await twoFactor.getTotpUri({
        password,
      })

      if (totpError || !totpData?.totpURI) {
        setError(totpError?.message || 'Failed to get TOTP URI')
        setIsLoading(false)
        return
      }

      setTotpUri(totpData.totpURI)
      setSetupStep('qr')
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (): Promise<void> => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { error: verifyError } = await twoFactor.verifyTotp({
        code: verificationCode,
      })

      if (verifyError) {
        setError(verifyError.message || 'Invalid code. Please try again.')
        setIsLoading(false)
        return
      }

      // Generate backup codes after successful verification
      try {
        const { data: codesData, error: codesError } = await twoFactor.generateBackupCodes({
          password,
        })

        if (!codesError && codesData?.backupCodes) {
          setBackupCodes(codesData.backupCodes)
        }
      } catch {
        // Continue even if backup codes fail - 2FA is still enabled
        console.error('Failed to generate backup codes')
      }

      setSetupStep('backup')
      setIsEnabled(true)
      await refreshSession()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable2FA = async (): Promise<void> => {
    if (!disablePassword.trim()) {
      setError('Please enter your password')
      return
    }

    setIsDisabling(true)
    setError('')

    try {
      const { error: disableError } = await twoFactor.disable({
        password: disablePassword,
      })

      if (disableError) {
        setError(disableError.message || 'Failed to disable 2FA')
        setIsDisabling(false)
        return
      }

      setIsEnabled(false)
      setShowDisableDialog(false)
      setDisablePassword('')
      await refreshSession()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsDisabling(false)
    }
  }

  const handleCopyCode = async (code: string): Promise<void> => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleCopyAllCodes = async (): Promise<void> => {
    await navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopiedCode('all')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleFinishSetup = (): void => {
    setSetupStep('idle')
    setPassword('')
    setTotpUri('')
    setVerificationCode('')
    setBackupCodes([])
    setError('')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/5 rounded-lg">
              <Shield className="h-5 w-5 text-black/60" />
            </div>
            <div>
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-700">2FA is enabled</p>
                  <p className="text-sm text-black/50">
                    Your account is protected with two-factor authentication
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldOff className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-700">2FA is not enabled</p>
                  <p className="text-sm text-black/50">
                    Enable two-factor authentication for better security
                  </p>
                </div>
              </div>
              <Button onClick={handleStartSetup}>
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupStep !== 'idle'} onOpenChange={(open) => !open && handleFinishSetup()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'password' && 'Confirm Your Password'}
              {setupStep === 'qr' && 'Scan QR Code'}
              {setupStep === 'verify' && 'Verify Code'}
              {setupStep === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'password' && 'Enter your password to continue setting up 2FA'}
              {setupStep === 'qr' && 'Scan this QR code with your authenticator app'}
              {setupStep === 'verify' && 'Enter the 6-digit code from your authenticator app'}
              {setupStep === 'backup' && 'Save these backup codes in a safe place'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          {setupStep === 'password' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}

          {setupStep === 'qr' && totpUri && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <QRCode value={totpUri} size={200} />
              </div>
              <p className="text-sm text-black/50 text-center">
                Use Google Authenticator, Authy, or any TOTP app
              </p>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                  autoComplete="one-time-code"
                />
              </div>
            </div>
          )}

          {setupStep === 'backup' && backupCodes.length > 0 && (
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Save these codes somewhere safe. You can use them to access your account if you lose your authenticator device.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <button
                    key={index}
                    onClick={() => handleCopyCode(code)}
                    className="flex items-center justify-between p-2 bg-black/5 rounded font-mono text-sm hover:bg-black/10 transition-colors"
                  >
                    <span>{code}</span>
                    {copiedCode === code ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-black/40" />
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyAllCodes}
              >
                {copiedCode === 'all' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy All Codes
                  </>
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            {setupStep === 'password' && (
              <>
                <Button variant="outline" onClick={handleFinishSetup}>
                  Cancel
                </Button>
                <Button onClick={handlePasswordSubmit} disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Continue
                </Button>
              </>
            )}

            {setupStep === 'qr' && (
              <>
                <Button variant="outline" onClick={handleFinishSetup}>
                  Cancel
                </Button>
                <Button onClick={() => setSetupStep('verify')}>
                  I&apos;ve scanned the code
                </Button>
              </>
            )}

            {setupStep === 'verify' && (
              <>
                <Button variant="outline" onClick={() => setSetupStep('qr')}>
                  Back
                </Button>
                <Button onClick={handleVerifyCode} disabled={isLoading || verificationCode.length !== 6}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Verify
                </Button>
              </>
            )}

            {setupStep === 'backup' && (
              <Button onClick={handleFinishSetup} className="w-full">
                I&apos;ve saved my backup codes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Are you sure you want to disable 2FA? This will make your account less secure.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Confirm your password</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDisableDialog(false)
              setDisablePassword('')
              setError('')
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={isDisabling || !disablePassword.trim()}
            >
              {isDisabling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
