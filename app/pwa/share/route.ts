import { NextRequest, NextResponse } from 'next/server';

/** Share Target / file handler do PWA — leva o usuário à tela de envio. */
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/enviar', req.url));
}

export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL('/enviar', req.url), 303);
}
