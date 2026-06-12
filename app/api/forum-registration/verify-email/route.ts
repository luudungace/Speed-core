import { NextResponse } from "next/server";
import { verifyRegisteredAccountEmail } from "@/lib/services/email-verification-service";
import { normalizeVietnameseText } from "@/lib/utils/text-normalize";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Missing account id." }, { status: 400 });
    }

    const result = await verifyRegisteredAccountEmail(body.id);
    return NextResponse.json(
      {
        ...result,
        status: normalizeVietnameseText(result.status),
        note: normalizeVietnameseText(result.note),
      },
      { status: result.verificationUrl ? 200 : 422 },
    );
  } catch (error) {
    const message = normalizeVietnameseText(error instanceof Error ? error.message : String(error));
    return NextResponse.json({ status: "Không xác nhận được", error: message, note: message }, { status: 500 });
  }
}
