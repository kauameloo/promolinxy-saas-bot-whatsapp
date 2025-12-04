// =====================================================
// ORDER DETAILS MODAL - Mostra detalhes completos do pedido
// =====================================================

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiUrl } from "@/lib/utils/api-url";

interface OrderDetailsModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function OrderDetailsModal({
  orderId,
  open,
  onOpenChange,
}: OrderDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(getApiUrl(`/api/orders/${orderId}`));
        const data = await resp.json();
        if (!data.success)
          throw new Error(data.error || "Erro ao carregar pedido");
        setOrder(data.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    if (open) fetchOrder();
  }, [orderId, open]);

  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado!");
    } catch {
      alert("Falha ao copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
          {/* Provide a description to satisfy accessibility and remove warning */}
          <p className="sr-only">
            Modal com informações completas do pedido selecionado, incluindo
            produto, valor, status, método de pagamento, PIX, links e dados do
            cliente.
          </p>
        </DialogHeader>
        {loading ? (
          <div>Carregando…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : order ? (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Resumo</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Produto: {order.product_name || "-"}</div>
                <div>
                  Valor:{" "}
                  {order.amount != null
                    ? `R$ ${Number(order.amount).toFixed(2)}`
                    : "-"}
                </div>
                <div>Status: {order.status}</div>
                <div>Método: {order.payment_method || "-"}</div>
                <div>
                  PIX:{" "}
                  {order.pix_code ? (
                    <>
                      <span className="truncate inline-block max-w-60 align-middle">
                        {order.pix_code}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(order.pix_code)}
                        className="ml-2"
                      >
                        Copiar
                      </Button>
                    </>
                  ) : (
                    "-"
                  )}
                </div>
                <div>
                  Boleto:{" "}
                  {order.boleto_url ? (
                    <a
                      className="text-blue-600"
                      href={order.boleto_url}
                      target="_blank"
                    >
                      Abrir
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
                <div>
                  Checkout:{" "}
                  {order.checkout_url ? (
                    <a
                      className="text-blue-600"
                      href={order.checkout_url}
                      target="_blank"
                    >
                      Abrir
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Cliente</h3>
              <div className="text-sm">
                {order.customer ? (
                  <ul className="space-y-1">
                    <li>Nome: {order.customer.name || "-"}</li>
                    <li>Telefone: {order.customer.phone || "-"}</li>
                    <li>Email: {order.customer.email || "-"}</li>
                  </ul>
                ) : (
                  <div>-</div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Metadados</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                {JSON.stringify(order.metadata || {}, null, 2)}
              </pre>
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
