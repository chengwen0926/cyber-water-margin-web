import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '赛博水浒入职日',
  description: 'HR 审查模拟游戏，采用早期 Macintosh 桌面风格。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
