import dynamic from 'next/dynamic';

const HomeView = dynamic(() => import('@/components/HomeView'), { ssr: false });

export default function HomePage() {
  return <HomeView />;
}
