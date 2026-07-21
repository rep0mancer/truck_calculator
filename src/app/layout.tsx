import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { cookies } from 'next/headers'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { defaultLocale, isLocale, localeCookie, translate } from '@/i18n'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export async function generateMetadata(): Promise<Metadata> {
  const value = (await cookies()).get(localeCookie)?.value
  const locale = isLocale(value) ? value : defaultLocale
  return { title: translate(locale, 'meta.title'), description: translate(locale, 'meta.description') }
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const value = (await cookies()).get(localeCookie)?.value
  const locale = isLocale(value) ? value : defaultLocale
  return (
    <html lang={locale} className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}><LocaleProvider initialLocale={locale}>{children}</LocaleProvider></body>
    </html>
  )
}
