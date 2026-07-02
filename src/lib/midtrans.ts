import MidtransClient from "midtrans-client";

export type SnapOrderParams = {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  itemId: string;
  itemName: string;
};

export type SnapTokenResult = {
  token: string;
  redirectUrl: string;
};

function getSnapClient() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY is not configured.");

  return new MidtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey,
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
  });
}

function getCoreApiClient() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY is not configured.");

  return new MidtransClient.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey,
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
  });
}

export async function createSnapToken(params: SnapOrderParams): Promise<SnapTokenResult> {
  const snap = getSnapClient();
  const parameter = {
    transaction_details: { order_id: params.orderId, gross_amount: params.amount },
    customer_details: { first_name: params.customerName, email: params.customerEmail },
    item_details: [{ id: params.itemId, price: params.amount, quantity: 1, name: params.itemName }],
    enabled_payments: ["credit_card", "gopay", "shopeepay", "other_qris", "permata_va", "bca_va", "bni_va", "bri_va", "cimb_va", "danamon_va", "echannel", "indomaret", "alfamart"],
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=finish`,
      error:  `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=error`,
      pending: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=pending`,
    },
  };
  const result = await snap.createTransaction(parameter) as { token: string; redirect_url: string };
  return { token: result.token, redirectUrl: result.redirect_url };
}

export async function verifyNotification(notificationPayload: object): Promise<MidtransClient.Transaction.TransactionStatus> {
  const coreApi = getCoreApiClient();
  // SDK's notification method automatically verifies the signature. Throws on invalid.
  return coreApi.transaction.notification(notificationPayload);
}

export function getMidtransClientKey(): string {
  return process.env.MIDTRANS_CLIENT_KEY ?? "";
}
