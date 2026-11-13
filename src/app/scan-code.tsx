import { useRouter } from "expo-router";
import { ScannerLayout } from "@/components/ScannerLayout";
export default function CodeScreen() {
  const router = useRouter();
  return (
    <ScannerLayout
      kind="code"
      onCapture={() => router.push("/found")}
      onManual={() => router.push("/product")}
    />
  );
}
