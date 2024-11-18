import React, { useState } from 'react';

const TestForm = () => {
  const [address, setAddress] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleTest = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telegram-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'DailyClaim',
          data: {
            artists: [{ artist: address, quantity: parseInt(quantity) }],
          },
        }),
      });

      alert('Notification sent!');
    } catch (error) {
      console.error('Test error:', error);
      alert('Failed to send notification');
    }
  };

  return (
    <main className='flex min-h-screen flex-col items-center justify-center p-4 space-y-8'>
      <div className='w-full max-w-md bg-white shadow-md rounded-lg p-6'>
        <div className='mb-4'>
          <h2 className='text-xl font-bold mb-4'>Test Notification</h2>
        </div>
        <div className='space-y-4'>
          <div>
            <label className='block mb-2 text-sm font-medium'>Wallet Address</label>
            <input
              className='w-full p-2 border rounded-md'
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder='0x...'
            />
          </div>
          <div>
            <label className='block mb-2 text-sm font-medium'>Quantity</label>
            <input
              className='w-full p-2 border rounded-md'
              type='number'
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder='141'
            />
          </div>
          <button
            onClick={handleTest}
            className='w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition-colors'
          >
            Send Test Notification
          </button>
        </div>
      </div>
    </main>
  );
};

export default TestForm;
