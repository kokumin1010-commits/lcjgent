import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function TaskCreate() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const { data: staffList, isLoading: isLoadingStaff } = trpc.staff.listActive.useQuery();
  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: (data) => {
      toast.success("タスクが正常に登録されました", {
        description: `タスクID: ${data.taskId}`,
      });
      setLocation("/tasks");
    },
    onError: (error) => {
      toast.error("タスクの登録に失敗しました", {
        description: error.message,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("画像ファイルを選択してください");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("スクリーンショット画像を選択してください");
      return;
    }

    if (!selectedStaffId) {
      toast.error("担当者を選択してください");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(",")[1];
        await createTaskMutation.mutateAsync({
          screenshotBase64: base64String,
          screenshotMimeType: selectedFile.type,
          staffId: parseInt(selectedStaffId),
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tasks")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新規タスク登録</h1>
          <p className="text-muted-foreground mt-2">
            スクリーンショットをアップロードして業務指示を自動抽出します
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>タスク情報入力</CardTitle>
          <CardDescription>
            チャットのスクリーンショットと担当者を選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="screenshot">スクリーンショット画像</Label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("screenshot")?.click()}
                  disabled={createTaskMutation.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  画像を選択
                </Button>
                <input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {selectedFile && (
                  <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
                )}
              </div>
              {previewUrl && (
                <div className="mt-4 border rounded-lg overflow-hidden max-w-2xl">
                  <img src={previewUrl} alt="Preview" className="w-full h-auto" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff">担当者</Label>
              {isLoadingStaff ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  読み込み中...
                </div>
              ) : (
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger id="staff">
                    <SelectValue placeholder="担当者を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList && staffList.length > 0 ? (
                      staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name} ({staff.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        担当者が登録されていません
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                type="submit"
                disabled={createTaskMutation.isPending || !selectedFile || !selectedStaffId}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  "タスクを登録"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/tasks")}
                disabled={createTaskMutation.isPending}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {createTaskMutation.isPending && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">AIが画像を解析しています...</p>
                <p className="text-sm text-muted-foreground">
                  スクリーンショットから指示内容を抽出しています。しばらくお待ちください。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
