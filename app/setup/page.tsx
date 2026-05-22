import dynamic from 'next/dynamic';

const SetupView = dynamic(() => import('@/components/SetupView'), { ssr: false });

export default function SetupPage() {
  return <SetupView />;
}
