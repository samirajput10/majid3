import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Scrap } from '@/lib/models/Scrap';

// Permanent delete: the scrap record is removed and the material stays gone
// — it does NOT go back into sellable stock. Use POST .../restore for that.
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const scrap = await Scrap.findByIdAndDelete(params.id);
    if (!scrap) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/scrap]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
