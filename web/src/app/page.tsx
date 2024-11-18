import { TestForm } from '@/components/TestForm';
import { Connect } from '../components/Connect';
import { Providers } from './providers';

export default function Home() {
  return (
    <Providers>
      <main className='flex min-h-screen flex-col items-center justify-center p-4'>
        <Connect />
        <TestForm />
      </main>
    </Providers>
  );
}
