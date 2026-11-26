// The brand's two fonts, loaded before the first frame renders (specs/design/brand.md).
import { loadFont as loadInstrumentSans } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";

loadInstrumentSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadNewsreader("normal", { weights: ["500"], subsets: ["latin"] });
