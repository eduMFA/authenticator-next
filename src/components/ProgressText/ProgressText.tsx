import { ThemedText } from "../Themed";

type ProgressTextProps = {
  styles?: any;
  value: string;
  progress?: number;
};

export default function ProgressText({
  styles,
  value,
  progress,
}: ProgressTextProps) {
  return <ThemedText style={styles}>{value}</ThemedText>;
}
