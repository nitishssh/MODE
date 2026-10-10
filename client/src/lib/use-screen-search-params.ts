import { useRoute } from "expo-router";
import { screenSearchParameters } from "./route-parameters";

/**
 * Expo 57's useLocalSearchParams decodes the URL-parser output a second time.
 * The public useRoute hook exposes the same local params without changing data
 * such as a literal %20 or an encoded query inside a login return target.
 */
export function useScreenSearchParams() {
  return screenSearchParameters(useRoute());
}
