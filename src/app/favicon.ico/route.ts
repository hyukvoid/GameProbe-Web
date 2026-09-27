// GameProbe has no logo or icon. Answer browsers' automatic favicon request without a 404.
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=86400' } })
}
