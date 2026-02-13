import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShoppingCart, 
  ArrowLeft, 
  Package, 
  Check, 
  Coins, 
  Truck, 
  Shield, 
  Gift, 
  ChevronRight,
  ChevronLeft,
  Heart,
  Share2,
  Minus,
  Plus,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Home,
  Building2,
  Loader2,
  Star,
  MessageSquare,
  ImageIcon,
  Trash2
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

// 商品画像ギャラリーコンポーネント
function ProductImageGallery({ product, isFavorite, setIsFavorite, handleShare }: {
  product: { imageUrl: string | null; imageUrls: string[] | null; name: string; pointPrice: number | null; stock: number };
  isFavorite: boolean;
  setIsFavorite: () => void;
  handleShare: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const images = useMemo(() => {
    if (product.imageUrls && product.imageUrls.length > 0) return product.imageUrls;
    if (product.imageUrl) return [product.imageUrl];
    return [];
  }, [product.imageUrls, product.imageUrl]);

  const currentImage = images[selectedIndex] || null;

  const goNext = () => {
    if (selectedIndex < images.length - 1) setSelectedIndex(selectedIndex + 1);
  };
  const goPrev = () => {
    if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
  };

  return (
    <div className="space-y-4">
      {/* メイン画像 */}
      <div className="aspect-square relative rounded-2xl overflow-hidden bg-white shadow-lg border border-pink-100">
        {currentImage ? (
          <img
            src={currentImage}
            alt={`${product.name} - 画像${selectedIndex + 1}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
            <Package className="h-32 w-32 text-pink-200" />
          </div>
        )}
        {product.pointPrice && (
          <div className="absolute top-4 left-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full blur-sm animate-pulse"></div>
              <Badge className="relative bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-900 px-4 py-2 text-lg shadow-lg border-2 border-amber-300 font-bold">
                <Coins className="h-5 w-5 mr-2 text-amber-700" />
                {product.pointPrice.toLocaleString()}pt
              </Badge>
            </div>
          </div>
        )}
        {product.stock <= 5 && product.stock > 0 && (
          <Badge className="absolute top-4 right-4 bg-red-500 text-white">
            残り{product.stock}点
          </Badge>
        )}
        {/* 左右ナビゲーション矢印 */}
        {images.length > 1 && (
          <>
            {selectedIndex > 0 && (
              <button
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
            )}
            {selectedIndex < images.length - 1 && (
              <button
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>
            )}
            {/* ページインジケーター */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === selectedIndex
                      ? "bg-white shadow-md scale-110"
                      : "bg-white/50 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* サムネイル一覧 */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                i === selectedIndex
                  ? "border-pink-500 ring-2 ring-pink-200"
                  : "border-gray-200 hover:border-pink-300"
              }`}
            >
              <img
                src={url}
                alt={`${product.name} - サムネイル${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className={`flex-1 ${isFavorite ? 'bg-pink-50 border-pink-300 text-pink-600' : ''}`}
          onClick={setIsFavorite}
        >
          <Heart className={`h-5 w-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
          お気に入り
        </Button>
        <Button variant="outline" className="flex-1" onClick={handleShare}>
          <Share2 className="h-5 w-5 mr-2" />
          シェア
        </Button>
      </div>
    </div>
  );
}

type PaymentMethod = "cash" | "points";
type PurchaseStep = "payment" | "address" | "confirm";

interface AddressForm {
  label: string;
  recipientName: string;
  phoneNumber: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
}

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
];

export default function MallProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("points");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [quantity, setQuantity] = useState(1);
  // お気に入り状態はAPIから取得
  const { data: favoriteIds = [] } = trpc.mall.getFavoriteIds.useQuery();
  const utils = trpc.useUtils();

  const addFavoriteMutation = trpc.mall.addFavorite.useMutation({
    onMutate: async ({ productId }) => {
      await utils.mall.getFavoriteIds.cancel();
      const prev = utils.mall.getFavoriteIds.getData() ?? [];
      utils.mall.getFavoriteIds.setData(undefined, [...prev, productId]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getFavoriteIds.setData(undefined, context.prev);
      toast.error("ログインが必要です");
    },
    onSettled: () => {
      utils.mall.getFavoriteIds.invalidate();
      utils.mall.getFavoriteCounts.invalidate();
    },
  });

  const removeFavoriteMutation = trpc.mall.removeFavorite.useMutation({
    onMutate: async ({ productId }) => {
      await utils.mall.getFavoriteIds.cancel();
      const prev = utils.mall.getFavoriteIds.getData() ?? [];
      utils.mall.getFavoriteIds.setData(undefined, prev.filter((fid) => fid !== productId));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) utils.mall.getFavoriteIds.setData(undefined, context.prev);
      toast.error("エラーが発生しました");
    },
    onSettled: () => {
      utils.mall.getFavoriteIds.invalidate();
      utils.mall.getFavoriteCounts.invalidate();
    },
  });

  const { data: cartCount } = trpc.mall.getCartCount.useQuery();

  const addToCartMutation = trpc.mall.addToCart.useMutation({
    onSuccess: () => {
      toast.success("カートに追加しました", { duration: 1500 });
      utils.mall.getCartCount.invalidate();
    },
    onError: () => {
      toast.error("ログインが必要です");
    },
  });

  const isFavorite = id ? favoriteIds.includes(Number(id)) : false;

  const handleToggleFavorite = () => {
    if (!id) return;
    const productId = Number(id);
    if (isFavorite) {
      removeFavoriteMutation.mutate({ productId });
      toast.success("お気に入りから削除しました", { duration: 1500 });
    } else {
      addFavoriteMutation.mutate({ productId });
      toast.success("お気に入りに追加しました", { duration: 1500 });
    }
  };
  const [purchaseStep, setPurchaseStep] = useState<PurchaseStep>("payment");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isNewAddress, setIsNewAddress] = useState(false);
  const [isSearchingPostalCode, setIsSearchingPostalCode] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    label: "自宅",
    recipientName: "",
    phoneNumber: "",
    postalCode: "",
    prefecture: "",
    city: "",
    addressLine1: "",
    addressLine2: "",
  });

  const { data: product, isLoading } = trpc.mall.getProductById.useQuery(
    { id: Number(id) },
    { enabled: !!id }
  );

  // 関連商品を取得（API版）
  const { data: relatedProductsData } = trpc.mall.getRelatedProducts.useQuery(
    { productId: Number(id) },
    { enabled: !!product }
  );

  // レビュー取得
  const { data: reviewData, refetch: refetchReviews } = trpc.mall.getReviews.useQuery(
    { productId: Number(id) },
    { enabled: !!id }
  );

  // 商品説明画像取得
  const { data: descImages } = trpc.mall.getDescImages.useQuery(
    { productId: Number(id) },
    { enabled: !!id }
  );

  // レビュー投稿state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewImages, setReviewImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [expandedReviewImage, setExpandedReviewImage] = useState<string | null>(null);

  const uploadReviewImageMutation = trpc.mall.uploadReviewImage.useMutation();

  const handleReviewImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: { file: File; preview: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      if (reviewImages.length + newImages.length >= 5) {
        toast.error("画像は最大5枚までです");
        break;
      }
      if (files[i].size > 5 * 1024 * 1024) {
        toast.error(`${files[i].name}は5MBを超えています`);
        continue;
      }
      newImages.push({ file: files[i], preview: URL.createObjectURL(files[i]) });
    }
    setReviewImages(prev => [...prev, ...newImages]);
    e.target.value = "";
  };

  const removeReviewImage = (index: number) => {
    setReviewImages(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submitReview = async () => {
    try {
      let imageUrls: string[] = [];
      if (reviewImages.length > 0) {
        setUploadingImages(true);
        const uploadPromises = reviewImages.map(async (img) => {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.readAsDataURL(img.file);
          });
          const res = await uploadReviewImageMutation.mutateAsync({
            base64,
            mimeType: img.file.type,
          });
          return res.url;
        });
        imageUrls = await Promise.all(uploadPromises);
        setUploadingImages(false);
      }
      createReviewMutation.mutate({
        productId: Number(id),
        rating: reviewRating,
        title: reviewTitle || undefined,
        content: reviewContent || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      });
    } catch {
      setUploadingImages(false);
      toast.error("画像のアップロードに失敗しました");
    }
  };

  const createReviewMutation = trpc.mall.createReview.useMutation({
    onSuccess: () => {
      toast.success("レビューを投稿しました");
      setShowReviewForm(false);
      setReviewRating(5);
      setReviewTitle("");
      setReviewContent("");
      reviewImages.forEach(img => URL.revokeObjectURL(img.preview));
      setReviewImages([]);
      refetchReviews();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteReviewMutation = trpc.mall.deleteReview.useMutation({
    onSuccess: () => {
      toast.success("レビューを削除しました");
      refetchReviews();
    },
  });

  // LINEユーザー情報を取得（ポイント残高確認用）
  const { data: lineUser } = trpc.lineLogin.me.useQuery();

  // 保存済み住所を取得
  const { data: savedAddresses, refetch: refetchAddresses } = trpc.mall.getMyAddresses.useQuery(
    undefined,
    { enabled: !!lineUser }
  );

  // 郵便番号検索
  const searchPostalCode = trpc.mall.searchAddressByPostalCode.useQuery(
    { postalCode: addressForm.postalCode },
    { enabled: addressForm.postalCode.length === 7 && isSearchingPostalCode }
  );

  // 住所追加
  const addAddress = trpc.mall.addAddress.useMutation({
    onSuccess: () => {
      refetchAddresses();
      toast.success("住所を保存しました");
    },
  });

  // 郵便番号検索結果を反映
  useEffect(() => {
    if (searchPostalCode.data?.found && searchPostalCode.data.address) {
      setAddressForm(prev => ({
        ...prev,
        prefecture: searchPostalCode.data.address!.prefecture,
        city: searchPostalCode.data.address!.city + (searchPostalCode.data.address!.town || ""),
      }));
      setIsSearchingPostalCode(false);
    }
  }, [searchPostalCode.data]);

  // デフォルト住所を選択
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !selectedAddressId) {
      const defaultAddress = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      setSelectedAddressId(defaultAddress.id);
    }
  }, [savedAddresses, selectedAddressId]);

  // 閲覧履歴を記録
  const recordViewMutation = trpc.mall.recordView.useMutation();
  useEffect(() => {
    if (product?.id) {
      recordViewMutation.mutate({ productId: product.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const purchaseWithPoints = trpc.mall.purchaseWithPoints.useMutation({
    onSuccess: () => {
      toast.success("購入が完了しました！", {
        description: "マイページで購入履歴を確認できます",
      });
      setIsPurchaseDialogOpen(false);
      setLocation("/mypage");
    },
    onError: (error) => {
      toast.error(error.message || "購入に失敗しました");
    },
  });

  const createCheckoutSession = trpc.mall.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("決済ページに移動します...", {
          description: "Stripeの安全な決済ページが開きます",
        });
        setIsPurchaseDialogOpen(false);
        // モバイルブラウザのポップアップブロッカー対策：同一タブで遷移
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      toast.error(error.message || "決済セッションの作成に失敗しました");
    },
  });

  const handlePostalCodeChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 7);
    setAddressForm(prev => ({ ...prev, postalCode: cleaned }));
    if (cleaned.length === 7) {
      setIsSearchingPostalCode(true);
    }
  };

  const handleNextStep = async () => {
    if (purchaseStep === "payment") {
      if (paymentMethod === "points" && !lineUser) {
        toast.error("ポイント購入にはLINEログインが必要です");
        setLocation("/line-login");
        return;
      }
      setPurchaseStep("address");
    } else if (purchaseStep === "address") {
      // 新しい住所入力の場合または保存済み住所がない場合
      if (isNewAddress || !savedAddresses || savedAddresses.length === 0) {
        // 新しい住所の場合、バリデーション
        if (!addressForm.recipientName || !addressForm.phoneNumber || 
            !addressForm.postalCode || !addressForm.prefecture || 
            !addressForm.city || !addressForm.addressLine1) {
          toast.error("必須項目を入力してください");
          return;
        }
        // 新しい住所を先に保存する
        try {
          const savedAddr = await addAddress.mutateAsync({
            label: addressForm.label,
            recipientName: addressForm.recipientName,
            phoneNumber: addressForm.phoneNumber,
            postalCode: addressForm.postalCode,
            prefecture: addressForm.prefecture,
            city: addressForm.city,
            addressLine1: addressForm.addressLine1,
            addressLine2: addressForm.addressLine2 || undefined,
            isDefault: !savedAddresses || savedAddresses.length === 0,
          });
          // 保存成功したら、保存済み住所として選択状態にする
          if (savedAddr && typeof savedAddr === 'object' && 'id' in savedAddr) {
            setSelectedAddressId((savedAddr as any).id);
            setIsNewAddress(false);
          }
        } catch (error) {
          console.error("住所保存エラー:", error);
          toast.error("住所の保存に失敗しました");
          return;
        }
      } else if (!selectedAddressId) {
        toast.error("配送先を選択してください");
        return;
      }
      setPurchaseStep("confirm");
    }
  };

  const handlePrevStep = () => {
    if (purchaseStep === "address") {
      setPurchaseStep("payment");
    } else if (purchaseStep === "confirm") {
      setPurchaseStep("address");
    }
  };

  const handlePurchase = async () => {
    if (!product) return;

    if (paymentMethod === "points") {
      if (!lineUser) {
        toast.error("ポイント購入にはLINEログインが必要です");
        setLocation("/line-login");
        return;
      }

      if (!product.pointPrice) {
        toast.error("この商品はポイント購入に対応していません");
        return;
      }

      setIsPurchasing(true);
      try {
        // 配送先情報を取得
        let shippingInfo: { name: string; phone: string; postalCode: string; address: string } | undefined;
        if (selectedAddress) {
          shippingInfo = {
            name: selectedAddress.recipientName,
            phone: selectedAddress.phoneNumber,
            postalCode: selectedAddress.postalCode,
            address: `${selectedAddress.prefecture}${selectedAddress.city}${selectedAddress.addressLine1}${selectedAddress.addressLine2 ? " " + selectedAddress.addressLine2 : ""}`,
          };
        } else if (addressForm.recipientName) {
          shippingInfo = {
            name: addressForm.recipientName,
            phone: addressForm.phoneNumber,
            postalCode: addressForm.postalCode,
            address: `${addressForm.prefecture}${addressForm.city}${addressForm.addressLine1}${addressForm.addressLine2 ? " " + addressForm.addressLine2 : ""}`,
          };
        }

        await purchaseWithPoints.mutateAsync({
          productId: product.id,
          quantity: quantity,
          shippingInfo,
        });
      } finally {
        setIsPurchasing(false);
      }
    } else {
      // Stripe決済
      setIsPurchasing(true);
      try {
        // 配送先情報を取得（住所はhandleNextStepで保存済みなのでselectedAddressを使用）
        let shippingInfo: { name: string; phone: string; postalCode: string; address: string } | undefined;
        // 新しい住所がまだフォームに残っている場合（保存が失敗した場合のフォールバック）
        if (selectedAddress) {
          shippingInfo = {
            name: selectedAddress.recipientName,
            phone: selectedAddress.phoneNumber,
            postalCode: selectedAddress.postalCode,
            address: `${selectedAddress.prefecture}${selectedAddress.city}${selectedAddress.addressLine1}${selectedAddress.addressLine2 ? " " + selectedAddress.addressLine2 : ""}`,
          };
        } else if (addressForm.recipientName) {
          // フォールバック：フォームのデータを使用
          shippingInfo = {
            name: addressForm.recipientName,
            phone: addressForm.phoneNumber,
            postalCode: addressForm.postalCode,
            address: `${addressForm.prefecture}${addressForm.city}${addressForm.addressLine1}${addressForm.addressLine2 ? " " + addressForm.addressLine2 : ""}`,
          };
        }

        await createCheckoutSession.mutateAsync({
          items: [{ productId: product.id, quantity }],
          shippingInfo,
        });
      } finally {
        setIsPurchasing(false);
      }
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.name || '',
        text: product?.description || '',
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("リンクをコピーしました");
    }
  };

  const resetDialog = () => {
    setPurchaseStep("payment");
    setIsNewAddress(false);
    setAddressForm({
      label: "自宅",
      recipientName: "",
      phoneNumber: "",
      postalCode: "",
      prefecture: "",
      city: "",
      addressLine1: "",
      addressLine2: "",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">商品を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Package className="h-20 w-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">商品が見つかりません</h3>
          <p className="text-muted-foreground mb-6">お探しの商品は存在しないか、削除された可能性があります</p>
          <Link href="/mall/products">
            <Button className="bg-gradient-to-r from-pink-500 to-rose-500">
              <ArrowLeft className="h-4 w-4 mr-2" />
              商品一覧に戻る
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canPurchaseWithPoints = lineUser && product.pointPrice && lineUser.points >= (product.pointPrice * quantity);
  const totalPointPrice = product.pointPrice ? product.pointPrice * quantity : 0;
  const totalCashPrice = product.price * quantity;
  const SHIPPING_FEE = 880;
  const FREE_SHIPPING_THRESHOLD = 5000;
  const shippingFee = totalCashPrice < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
  const totalWithShipping = totalCashPrice + shippingFee;
  const selectedAddress = savedAddresses?.find(a => a.id === selectedAddressId);

  // 関連商品（現在の商品を除く）
  const filteredRelatedProducts = relatedProductsData?.slice(0, 6) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-pink-50/30">
      {/* ヘッダー */}
      <header className="bg-white/90 backdrop-blur-md border-b border-pink-100 sticky top-0 z-50 shadow-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/mall/products" className="flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span className="hidden sm:inline">戻る</span>
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                  LCJ MALL
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {lineUser && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-50 to-orange-50 px-3 py-1.5 rounded-full border border-yellow-200">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-bold text-yellow-700">{lineUser.points.toLocaleString()}</span>
                  <span className="text-xs text-yellow-600">pt</span>
                </div>
              )}
              <Link href="/mall/cart" className="relative">
                <ShoppingCart className="h-5 w-5 text-gray-600 hover:text-pink-500 transition-colors" />
                {(cartCount?.count ?? 0) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-pink-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {cartCount!.count > 99 ? "99+" : cartCount!.count}
                  </span>
                )}
              </Link>
              <Link href="/mypage">
                <Button variant="outline" size="sm" className="border-pink-200 hover:bg-pink-50">
                  マイページ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 md:py-10">
        {/* パンくずリスト */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-pink-500">ホーム</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/mall/products" className="hover:text-pink-500">商品一覧</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* 商品画像ギャラリーセクション */}
          <ProductImageGallery product={product} isFavorite={isFavorite} setIsFavorite={handleToggleFavorite} handleShare={handleShare} />

          {/* 商品情報セクション */}
          <div className="space-y-6">
            <div>
              {product.category && (
                <Badge variant="outline" className="mb-3 border-pink-200 text-pink-600">
                  {product.category}
                </Badge>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>
              
              {/* 価格表示 */}
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <span className="text-sm text-muted-foreground">販売価格</span>
                  <p className="text-4xl font-bold text-pink-600">
                    ¥{product.price.toLocaleString()}
                  </p>
                </div>
                {product.pointPrice && (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-2xl blur-md opacity-50 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-5 py-3 rounded-2xl border-2 border-amber-300 shadow-lg shadow-amber-200/50">
                      <span className="text-sm font-semibold text-amber-800">✨ ポイント価格</span>
                      <p className="text-3xl font-black text-amber-900">
                        {product.pointPrice.toLocaleString()}<span className="text-xl">pt</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 在庫状況 */}
              <div className="flex items-center gap-2 mb-4">
                {product.stock > 0 ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">在庫あり</span>
                    {product.stock <= 10 && (
                      <span className="text-orange-500 text-sm">（残り{product.stock}点）</span>
                    )}
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-500">在庫切れ</span>
                  </>
                )}
              </div>
            </div>

            {/* 商品説明 */}
            {product.description && (
              <div className="prose prose-pink max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* 特典バッジ */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm">
                <Truck className="h-4 w-4" />
                送料無料
              </div>
              <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm">
                <Shield className="h-4 w-4" />
                品質保証
              </div>
              <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm">
                <Gift className="h-4 w-4" />
                ギフト対応
              </div>
            </div>

            {/* 購入カード */}
            <Card className="border-2 border-pink-200 shadow-xl">
              <CardContent className="p-6 space-y-4">
                {/* 数量選択 */}
                {product.stock > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">数量</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-bold">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                        disabled={quantity >= product.stock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 購入ボタン */}
                {product.stock > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1 border-pink-300 text-pink-500 hover:bg-pink-50 text-base py-7 rounded-xl transition-all"
                      onClick={() => {
                        addToCartMutation.mutate({ productId: product.id, quantity });
                      }}
                      disabled={addToCartMutation.isPending}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      カートに入れる
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-base py-7 rounded-xl shadow-lg hover:shadow-xl transition-all"
                      onClick={() => {
                        resetDialog();
                        setIsPurchaseDialogOpen(true);
                      }}
                    >
                      今すぐ購入
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ポイント購入の案内 */}
            {product.pointPrice && (
              <Card className="bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 border-yellow-200 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-400 p-3 rounded-xl shadow-md">
                      <Coins className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg mb-1">ポイントでお得に購入！</p>
                      <p className="text-muted-foreground text-sm mb-3">
                        この商品は<span className="font-bold text-orange-600">{product.pointPrice.toLocaleString()}ポイント</span>で購入できます。
                        レシートを送るだけでポイントが貯まります！
                      </p>
                      {!lineUser ? (
                        <Link href="/line-login">
                          <Button className="bg-[#06C755] hover:bg-[#05b34c] text-white">
                            LINEでログインしてポイントを使う
                          </Button>
                        </Link>
                      ) : lineUser.points >= product.pointPrice ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-semibold">ポイントで購入可能です！</span>
                        </div>
                      ) : (
                        <p className="text-sm text-orange-600">
                          あと<span className="font-bold">{(product.pointPrice - lineUser.points).toLocaleString()}</span>ポイントで購入できます
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ===== 商品説明LP風セクション ===== */}
        {descImages && descImages.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-pink-500" />
              商品について
            </h2>
            <div className="space-y-0">
              {descImages.map((img) => (
                <div key={img.id} className="w-full">
                  <img
                    src={img.imageUrl}
                    alt={img.caption || `商品説明画像 ${img.sortOrder + 1}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  {img.caption && (
                    <p className="text-center text-sm text-muted-foreground py-2">{img.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== レビュー・星評価セクション ===== */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-pink-500" />
              カスタマーレビュー
            </h2>
            {lineUser && (
              <Button
                onClick={() => setShowReviewForm(!showReviewForm)}
                variant="outline"
                className="border-pink-300 text-pink-600 hover:bg-pink-50"
              >
                <Star className="h-4 w-4 mr-2" />
                レビューを書く
              </Button>
            )}
          </div>

          {/* レビュー統計 */}
          {reviewData?.stats && Number(reviewData.stats.totalReviews) > 0 && (
            <Card className="mb-8 border-pink-100">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-5xl font-bold text-pink-600">
                      {Number(reviewData.stats.avgRating).toFixed(1)}
                    </div>
                    <div className="flex mt-2">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-5 w-5 ${s <= Math.round(Number(reviewData.stats.avgRating)) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{Number(reviewData.stats.totalReviews)}件のレビュー</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5,4,3,2,1].map(star => {
                      const count = Number(reviewData.stats[`rating${star}` as keyof typeof reviewData.stats]) || 0;
                      const total = Number(reviewData.stats.totalReviews) || 1;
                      const pct = (count / total) * 100;
                      return (
                        <div key={star} className="flex items-center gap-3">
                          <span className="text-sm w-8 text-right">{star}★</span>
                          <Progress value={pct} className="flex-1 h-3" />
                          <span className="text-sm text-muted-foreground w-10">{count}件</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* レビュー投稿フォーム */}
          {showReviewForm && lineUser && (
            <Card className="mb-8 border-pink-200 bg-pink-50/30">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">レビューを投稿</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">評価</Label>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(s => (
                        <button
                          key={s}
                          type="button"
                          onMouseEnter={() => setHoverRating(s)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setReviewRating(s)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star className={`h-8 w-8 ${s <= (hoverRating || reviewRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="review-title" className="mb-2 block">タイトル（任意）</Label>
                    <Input
                      id="review-title"
                      value={reviewTitle}
                      onChange={e => setReviewTitle(e.target.value)}
                      placeholder="一言で感想を..."
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label htmlFor="review-content" className="mb-2 block">レビュー内容（任意）</Label>
                    <Textarea
                      id="review-content"
                      value={reviewContent}
                      onChange={e => setReviewContent(e.target.value)}
                      placeholder="商品の使い心地、おすすめポイントなどを教えてください"
                      rows={4}
                      maxLength={2000}
                    />
                  </div>
                  {/* 画像アップロード */}
                  <div>
                    <Label className="mb-2 block">写真を追加（最大5枚、各最大5MB）</Label>
                    <div className="flex gap-2 flex-wrap">
                      {reviewImages.map((img, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-pink-200 group">
                          <img src={img.preview} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeReviewImage(i)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {reviewImages.length < 5 && (
                        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-pink-300 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors">
                          <ImageIcon className="h-5 w-5 text-pink-400" />
                          <span className="text-[10px] text-pink-400 mt-1">追加</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleReviewImageSelect}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={submitReview}
                      disabled={createReviewMutation.isPending || uploadingImages}
                      className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                    >
                      {uploadingImages ? "画像アップロード中..." : createReviewMutation.isPending ? "投稿中..." : "レビューを投稿"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowReviewForm(false); reviewImages.forEach(img => URL.revokeObjectURL(img.preview)); setReviewImages([]); }}>キャンセル</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* レビュー一覧 */}
          {reviewData?.reviews && reviewData.reviews.length > 0 ? (
            <div className="space-y-4">
              {reviewData.reviews.map(({ review, user }) => (
                <Card key={review.id} className="border-pink-50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {user?.pictureUrl ? (
                          <img src={user.pictureUrl} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-pink-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm">{user?.displayName || '匿名ユーザー'}</p>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-4 w-4 ${s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                            ))}
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(review.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      {lineUser && String(lineUser.lineUserId) === String(user?.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReviewMutation.mutate({ reviewId: review.id })}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {review.title && <p className="font-semibold mt-3">{review.title}</p>}
                    {review.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{review.content}</p>}
                    {review.imageUrls && (review.imageUrls as string[]).length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {(review.imageUrls as string[]).map((url, i) => (
                          <button key={i} type="button" onClick={() => setExpandedReviewImage(url)} className="focus:outline-none">
                            <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border hover:opacity-80 transition-opacity cursor-zoom-in" />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-pink-50">
              <CardContent className="p-8 text-center">
                <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">まだレビューがありません</p>
                {lineUser && (
                  <Button
                    onClick={() => setShowReviewForm(true)}
                    variant="outline"
                    className="mt-4 border-pink-300 text-pink-600"
                  >
                    最初のレビューを書く
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* レビュー画像拡大ダイアログ */}
        {expandedReviewImage && (
          <Dialog open={!!expandedReviewImage} onOpenChange={() => setExpandedReviewImage(null)}>
            <DialogContent className="max-w-2xl p-2">
              <DialogHeader className="sr-only">
                <DialogTitle>レビュー画像</DialogTitle>
                <DialogDescription>レビューに添付された画像</DialogDescription>
              </DialogHeader>
              <img src={expandedReviewImage} alt="レビュー画像" className="w-full h-auto rounded-lg" />
            </DialogContent>
          </Dialog>
        )}

        {/* ===== 関連商品・おすすめ商品 ===== */}
        {filteredRelatedProducts.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">関連商品・おすすめ</h2>
              <Link href="/mall/products">
                <Button variant="ghost" className="text-pink-500 hover:text-pink-600">
                  すべて見る
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredRelatedProducts.map((rp) => (
                <Link key={rp.id} href={`/mall/products/${rp.id}`}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-pink-100">
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      {rp.imageUrl ? (
                        <img src={rp.imageUrl} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                      {rp.pointPrice && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-xs">
                          <Coins className="h-3 w-3 mr-1" />{rp.pointPrice}pt
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-pink-500 transition-colors">{rp.name}</h3>
                      <p className="text-lg font-bold text-pink-600">¥{rp.price.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 購入ダイアログ */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={(open) => {
        setIsPurchaseDialogOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {purchaseStep === "payment" && "お支払い方法を選択"}
              {purchaseStep === "address" && "配送先を選択"}
              {purchaseStep === "confirm" && "ご注文内容の確認"}
            </DialogTitle>
            <DialogDescription>
              {product.name} × {quantity}点
            </DialogDescription>
          </DialogHeader>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-2 py-4">
            {["payment", "address", "confirm"].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  purchaseStep === step 
                    ? "bg-pink-500 text-white" 
                    : index < ["payment", "address", "confirm"].indexOf(purchaseStep)
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}>
                  {index < ["payment", "address", "confirm"].indexOf(purchaseStep) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 2 && (
                  <div className={`w-12 h-1 mx-1 ${
                    index < ["payment", "address", "confirm"].indexOf(purchaseStep)
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* ステップ1: 支払い方法選択 */}
          {purchaseStep === "payment" && (
            <div className="py-4">
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <div className="space-y-3">
                  {product.pointPrice && (
                    <Label
                      htmlFor="points"
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        paymentMethod === "points" 
                          ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                          : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                      } ${!lineUser ? "opacity-60" : ""}`}
                    >
                      <RadioGroupItem value="points" id="points" disabled={!lineUser} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Coins className="h-5 w-5 text-yellow-500" />
                          <p className="font-bold">ポイントで購入</p>
                          {canPurchaseWithPoints && (
                            <Badge className="bg-green-500 text-xs">おすすめ</Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-orange-600">
                          {totalPointPrice.toLocaleString()}pt
                        </p>
                        {lineUser && (
                          <p className="text-sm text-muted-foreground mt-1">
                            残高: {lineUser.points.toLocaleString()}pt
                            {canPurchaseWithPoints ? (
                              <span className="text-green-600 ml-2">→ 購入後: {(lineUser.points - totalPointPrice).toLocaleString()}pt</span>
                            ) : (
                              <span className="text-red-500 ml-2">（{(totalPointPrice - lineUser.points).toLocaleString()}pt不足）</span>
                            )}
                          </p>
                        )}
                        {!lineUser && (
                          <p className="text-xs text-pink-600 mt-1">
                            LINEログインが必要です
                          </p>
                        )}
                      </div>
                    </Label>
                  )}

                  <Label
                    htmlFor="cash"
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      paymentMethod === "cash" 
                        ? "border-pink-500 bg-gradient-to-r from-pink-50 to-rose-50 shadow-md" 
                        : "border-gray-200 hover:border-pink-200 hover:bg-pink-50/50"
                    }`}
                  >
                    <RadioGroupItem value="cash" id="cash" />
                    <div className="flex-1">
                      <p className="font-bold mb-1">現金で購入</p>
                      <p className="text-2xl font-bold text-pink-600">
                        ¥{totalCashPrice.toLocaleString()}
                        {shippingFee > 0 && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">+ 送料¥{shippingFee.toLocaleString()}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        クレジットカード決済（Stripeセキュア決済）
                      </p>
                      {shippingFee > 0 ? (
                        <p className="text-xs text-amber-600 mt-0.5">※ ¥{FREE_SHIPPING_THRESHOLD.toLocaleString()}以上のご購入で送料無料</p>
                      ) : (
                        <p className="text-xs text-green-600 mt-0.5">✓ 送料無料</p>
                      )}
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* ステップ2: 配送先選択 */}
          {purchaseStep === "address" && (
            <div className="py-4 space-y-4">
              {/* 保存済み住所 */}
              {savedAddresses && savedAddresses.length > 0 && !isNewAddress && (
                <div className="space-y-3">
                  <p className="font-medium text-sm text-muted-foreground">保存済みの住所</p>
                  <RadioGroup value={selectedAddressId?.toString()} onValueChange={(v) => setSelectedAddressId(Number(v))}>
                    {savedAddresses.map((address) => (
                      <Label
                        key={address.id}
                        htmlFor={`address-${address.id}`}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddressId === address.id
                            ? "border-pink-500 bg-pink-50"
                            : "border-gray-200 hover:border-pink-200"
                        }`}
                      >
                        <RadioGroupItem value={address.id.toString()} id={`address-${address.id}`} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {address.label === "自宅" ? (
                              <Home className="h-4 w-4 text-pink-500" />
                            ) : (
                              <Building2 className="h-4 w-4 text-pink-500" />
                            )}
                            <span className="font-bold">{address.label}</span>
                            {address.isDefault && (
                              <Badge variant="outline" className="text-xs">デフォルト</Badge>
                            )}
                          </div>
                          <p className="text-sm">{address.recipientName}</p>
                          <p className="text-sm text-muted-foreground">
                            〒{address.postalCode.slice(0, 3)}-{address.postalCode.slice(3)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.prefecture}{address.city}{address.addressLine1}
                            {address.addressLine2 && ` ${address.addressLine2}`}
                          </p>
                          <p className="text-sm text-muted-foreground">{address.phoneNumber}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsNewAddress(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新しい住所を追加
                  </Button>
                </div>
              )}

              {/* 新しい住所入力フォーム */}
              {(isNewAddress || !savedAddresses || savedAddresses.length === 0) && (
                <div className="space-y-4">
                  {savedAddresses && savedAddresses.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsNewAddress(false)}
                      className="mb-2"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      保存済み住所に戻る
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">住所ラベル</Label>
                      <Select
                        value={addressForm.label}
                        onValueChange={(v) => setAddressForm(prev => ({ ...prev, label: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="自宅">自宅</SelectItem>
                          <SelectItem value="会社">会社</SelectItem>
                          <SelectItem value="その他">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientName">
                        <User className="h-4 w-4 inline mr-1" />
                        お名前 <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="recipientName"
                        value={addressForm.recipientName}
                        onChange={(e) => setAddressForm(prev => ({ ...prev, recipientName: e.target.value }))}
                        placeholder="山田 太郎"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      <Phone className="h-4 w-4 inline mr-1" />
                      電話番号 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phoneNumber"
                      value={addressForm.phoneNumber}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, phoneNumber: e.target.value.replace(/[^0-9-]/g, "") }))}
                      placeholder="090-1234-5678"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        郵便番号 <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="postalCode"
                          value={addressForm.postalCode}
                          onChange={(e) => handlePostalCodeChange(e.target.value)}
                          placeholder="1234567"
                          maxLength={7}
                        />
                        {isSearchingPostalCode && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">ハイフンなしで入力</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prefecture">
                        都道府県 <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={addressForm.prefecture}
                        onValueChange={(v) => setAddressForm(prev => ({ ...prev, prefecture: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {PREFECTURES.map((pref) => (
                            <SelectItem key={pref} value={pref}>{pref}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">
                      市区町村 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="city"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="渋谷区渋谷"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">
                      番地 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="addressLine1"
                      value={addressForm.addressLine1}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="1-2-3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">
                      建物名・部屋番号（任意）
                    </Label>
                    <Input
                      id="addressLine2"
                      value={addressForm.addressLine2}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                      placeholder="○○マンション 101号室"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ステップ3: 確認 */}
          {purchaseStep === "confirm" && (
            <div className="py-4 space-y-4">
              {/* 商品情報 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2">ご注文商品</h4>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-white">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">数量: {quantity}</p>
                  </div>
                  <div className="text-right">
                    {paymentMethod === "points" ? (
                      <p className="font-bold text-orange-600">{totalPointPrice.toLocaleString()}pt</p>
                    ) : (
                      <p className="font-bold text-pink-600">¥{totalCashPrice.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 配送先 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  配送先
                </h4>
                {isNewAddress ? (
                  <div className="text-sm">
                    <p className="font-medium">{addressForm.recipientName}</p>
                    <p className="text-muted-foreground">
                      〒{addressForm.postalCode.slice(0, 3)}-{addressForm.postalCode.slice(3)}
                    </p>
                    <p className="text-muted-foreground">
                      {addressForm.prefecture}{addressForm.city}{addressForm.addressLine1}
                      {addressForm.addressLine2 && ` ${addressForm.addressLine2}`}
                    </p>
                    <p className="text-muted-foreground">{addressForm.phoneNumber}</p>
                  </div>
                ) : selectedAddress && (
                  <div className="text-sm">
                    <p className="font-medium">{selectedAddress.recipientName}</p>
                    <p className="text-muted-foreground">
                      〒{selectedAddress.postalCode.slice(0, 3)}-{selectedAddress.postalCode.slice(3)}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedAddress.prefecture}{selectedAddress.city}{selectedAddress.addressLine1}
                      {selectedAddress.addressLine2 && ` ${selectedAddress.addressLine2}`}
                    </p>
                    <p className="text-muted-foreground">{selectedAddress.phoneNumber}</p>
                  </div>
                )}
              </div>

              {/* 支払い方法 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  {paymentMethod === "points" ? (
                    <Coins className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  お支払い方法
                </h4>
                <p className="text-sm">
                  {paymentMethod === "points" ? "ポイント決済" : "クレジットカード決済（Stripe）"}
                </p>
              </div>

              {/* 送料・合計 */}
              <div className="border-t pt-4 space-y-2">
                {paymentMethod !== "points" && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">小計</span>
                      <span>¥{totalCashPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">送料</span>
                      {shippingFee > 0 ? (
                        <span>¥{shippingFee.toLocaleString()}</span>
                      ) : (
                        <span className="text-green-600 font-medium">無料</span>
                      )}
                    </div>
                    {shippingFee > 0 && (
                      <p className="text-xs text-muted-foreground">※ ¥{FREE_SHIPPING_THRESHOLD.toLocaleString()}以上のご購入で送料無料</p>
                    )}
                  </>
                )}
                <div className="flex justify-between items-center text-lg font-bold pt-1">
                  <span>合計</span>
                  {paymentMethod === "points" ? (
                    <span className="text-orange-600">{totalPointPrice.toLocaleString()}pt</span>
                  ) : (
                    <span className="text-pink-600">¥{totalWithShipping.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {purchaseStep !== "payment" && (
              <Button variant="outline" onClick={handlePrevStep}>
                戻る
              </Button>
            )}
            {purchaseStep === "payment" && (
              <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
                キャンセル
              </Button>
            )}
            {purchaseStep !== "confirm" ? (
              <Button
                onClick={handleNextStep}
                disabled={paymentMethod === "points" && !canPurchaseWithPoints}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                次へ
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    処理中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    注文を確定する
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フッター */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-10 mt-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-pink-400" />
              <span className="text-xl font-bold">LCJ MALL</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
              <Link href="/mypage" className="hover:text-white transition-colors">マイページ</Link>
              <Link href="/legal/tokushoho" className="hover:text-white transition-colors">特定商取引法</Link>
              <Link href="/legal/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
              <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            </div>
            <p className="text-gray-500 text-sm">© 2024 LCJ MALL. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
