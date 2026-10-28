import { useNavigate } from "react-router";
import { deleteBuild, type BuildDetail } from "../api";
import { DeleteDialog } from "./DeleteDialog";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "“X” and its 7 parts, 1 bundle and 1 extra cost will be deleted.", leaving out empty lists. */
function deleteMessage(build: BuildDetail): string {
  const children = [
    build.parts.length > 0 && count(build.parts.length, "part", "parts"),
    build.bundles.length > 0 &&
      count(build.bundles.length, "bundle", "bundles"),
    build.extra_costs.length > 0 &&
      count(build.extra_costs.length, "extra cost", "extra costs"),
  ].filter((c) => c !== false);
  // en-GB: "7 parts, 1 bundle and 3 extra costs", no Oxford comma.
  const list = new Intl.ListFormat("en-GB").format(children);
  const its = list ? ` and its ${list}` : "";
  return `“${build.name}”${its} will be deleted. This can’t be undone.`;
}

export function DeleteBuildDialog({
  build,
  onClose,
}: {
  build: BuildDetail;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <DeleteDialog
      what="build"
      message={deleteMessage(build)}
      onConfirm={async () => {
        await deleteBuild(build.id);
        navigate("/");
      }}
      onClose={onClose}
    />
  );
}
