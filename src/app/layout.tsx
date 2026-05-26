import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BaMo Ads Manager',
  description: 'Advertisement management for BaMo clients',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-bamo-bg min-h-screen">{children}</body>
    </html>
  )
}
