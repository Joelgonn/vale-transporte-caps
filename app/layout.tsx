import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadados otimizados para o sistema
export const metadata: Metadata = {
  title: {
    template: "%s | Sistema CAPS",
    default: "Vale Transporte CAPS - Gestão Inteligente",
  },
  description: "Sistema de gestão e controle de vale transporte para pacientes do Centro de Atenção Psicossocial (CAPS).",
};

// Define a cor da barra do navegador (mobile) — azul institucional (brand-600).
export const viewport: Viewport = {
  themeColor: "#2c5899",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* 
        bg-zinc-50: Fundo cinza super claro (tira o branco "duro" do fundo)
        Cor do texto: vem de app/globals.css (--foreground, azul institucional brand-900).
        selection:*: Cor de quando o usuário seleciona um texto (paleta brand/accent).
      */}
      <body 
        className="min-h-full flex flex-col bg-zinc-50 selection:bg-brand-200 selection:text-brand-900 font-sans"
      >
        {children}
      </body>
    </html>
  );
}