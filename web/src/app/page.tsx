import { Providers } from './providers';
import { Connect } from './connect';

export default function Home() {
  return (
    <Providers>
      <main className='min-h-screen p-4 flex flex-col items-center justify-center'>
        <div className='w-full max-w-md'>
          <Connect />
        </div>
      </main>
    </Providers>
  );
}
