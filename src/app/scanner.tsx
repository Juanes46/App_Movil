import { useLocalSearchParams, useRouter } from "expo-router";
import { ScannerLayout } from "@/components/ScannerLayout";
import { addDays, detectExpirationDate, formatDate } from "@/utils/expiration";
export default function DateScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    category?: string;
    id?: string;
    quantity?: string;
    location?: string;
  }>();
  const manual = () =>
    router.replace({ pathname: "/product", params: { ...params } });
  function capture() {
    const detected = detectExpirationDate(
      "VENCE " + formatDate(addDays(new Date(), 3)),
    );
    router.replace({
      pathname: "/product",
      params: {
        ...params,
        name: params.name || "Leche entera 1 L",
        category: params.category || "Lácteos",
        date: detected ? formatDate(detected.date) : "",
        source: "demo",
      },
    });
  }
  return <ScannerLayout kind="date" onCapture={capture} onManual={manual} />;
}
