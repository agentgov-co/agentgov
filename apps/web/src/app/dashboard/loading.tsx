import { LogoLoader } from '@/components/logo'

export default function DashboardLoading(): React.JSX.Element {
  return (
    <div className="flex-1 flex items-center justify-center">
      <LogoLoader size={32} />
    </div>
  )
}
