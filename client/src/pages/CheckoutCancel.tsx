import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, ArrowLeft, ShoppingBag, RefreshCw } from "lucide-react";
import { Link, useSearch } from "wouter";

export default function CheckoutCancel() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderNumber = params.get("order") || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="container max-w-lg mx-auto px-4 py-12">
        <Card className="border-orange-200 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-12 w-12 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-orange-800 mb-2">
              お支払いがキャンセルされました
            </h1>
            <p className="text-muted-foreground mb-6">
              決済は完了していません。商品はカートに残っています。
            </p>

            {orderNumber && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">注文番号</p>
                <p className="text-lg font-mono font-bold text-gray-800">{orderNumber}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  この注文は未決済のままです
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Link href="/mall/products">
                <Button className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  お買い物に戻る
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  トップページに戻る
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
