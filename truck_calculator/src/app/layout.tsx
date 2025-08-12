export const metadata = { title: 'Truck Loading Space Calculator' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="header">
          <div className="container"><h1>Truck Loading Space Calculator</h1></div>
        </div>
        <div className="container" style={{marginTop:16}}>{children}</div>
      </body>
    </html>
  );
}
