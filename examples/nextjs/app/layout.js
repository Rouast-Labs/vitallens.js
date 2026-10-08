export const metadata = { title: 'VitalLens + Next.js' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'black' }}>{children}</body>
    </html>
  );
}
