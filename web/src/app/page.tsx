import { Providers } from './providers';
import { Connect } from './connect';

export default function Home() {
  return (
    <main className='min-h-screen p-4 flex flex-col items-center justify-center'>
      <Providers>
        <div className='w-full max-w-md'>
          <h1 className='text-2xl font-bold mb-8 text-center'>Connect Wallet & Telegram</h1>
          <Connect />
        </div>
      </Providers>
    </main>
  );
}
