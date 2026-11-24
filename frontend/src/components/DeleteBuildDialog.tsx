import { useNavigate } from "react-router";
import { deleteBuild, type BuildDetail } from "../api";
import { plural } from "../words";
import { DeleteDialog } from "./DeleteDialog";

/** "“X” and its 7 parts, 1 bundle and 1 extra cost will be deleted.", leaving out empty lists. */
function deleteMessage(build: BuildDetail): string {
  const children = [
    build.parts.length > 0 && plural(build.parts.length, "part"),
    build.bundles.length > 0 && plural(build.bundles.length, "bundle"),
    build.extra_costs.length > 0 &&
      plural(build.extra_costs.length, "extra cost"),
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
