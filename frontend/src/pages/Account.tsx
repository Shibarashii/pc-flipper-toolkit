import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  connectGoogle,
  disconnectGoogle,
  generalError,
  getMe,
  renameUser,
  type Me,
} from "../api";
import { getToken, saveSession } from "../auth";
import { Field, useSave } from "../components/form";
import { Bone, Skeleton } from "../components/Skeleton";
import { GoogleButton, googleClientId } from "../google";
import { buttonPrimary, buttonSecondary, input } from "../ui";

const section = "border-t border-line-strong pt-4";
const heading = "font-serif text-[22px] leading-7 font-medium";

/** Who you're logged in as, your username, and connecting Google (`/account`). */
export function Account() {
  const [me, setMe] = useState<Me | "loading" | "error">("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    getMe().then(
      (loaded) => !ignore && setMe(loaded),
      () => !ignore && setMe("error"),
    );
    return () => {
      ignore = true;
    };
  }, []);

  // Connect and disconnect: the answer replaces the Google row, a refusal shows above it.
  async function change(request: () => Promise<Me["google"]>) {
    if (typeof me !== "object") return;
    setSaving(true);
    setError("");
    try {
      const google = await request();
      setMe({ ...me, google });
    } catch (err) {
      setError(
        generalError(err, err instanceof ApiError ? err.fieldErrors : {}),
      );
    }
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-[640px] px-4 pt-12 pb-16 text-[15px] leading-[22px] sm:pt-20">
      <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
        Account
      </h1>

      {me === "loading" && (
        <Skeleton label="Loading your account" className="mt-3">
          <Bone className="h-[18px] w-32" />
          <Bone className="mt-12 h-7 w-24" />
          <Bone className="mt-3 h-10 w-full max-w-[400px]" />
        </Skeleton>
      )}

      {me === "error" && (
        <div
          role="alert"
          className="mt-8 rounded border border-loss bg-surface px-4 py-3"
        >
          <p className="font-medium text-loss">Couldn’t load your account</p>
          <p className="text-[13px] text-muted">
            The server didn’t respond. Check your connection and reload.
          </p>
        </div>
      )}

      {typeof me === "object" && (
        <>
          <p className="mt-1.5 text-[13px] leading-[18px] text-muted">
            Logged in as{" "}
            <span className="font-medium text-ink">{me.username}</span>
          </p>

          {me.is_demo ? (
            <p className={`mt-8 sm:mt-12 ${section}`}>
              Demo accounts can’t change their account. Sign up for your own
              account first.
            </p>
          ) : (
            <>
              <section className={`mt-8 sm:mt-12 ${section}`}>
                <h2 className={heading}>Username</h2>
                <UsernameRow me={me} onRenamed={setMe} />
              </section>

              <section className={`mt-8 ${section}`}>
                <h2 className={heading}>Google</h2>
                {error && (
                  <p
                    role="alert"
                    className="mt-3 text-[13px] leading-[18px] text-loss"
                  >
                    {error}
                  </p>
                )}
                <GoogleRow
                  me={me}
                  saving={saving}
                  onConnect={(credential) =>
                    change(async () => (await connectGoogle(credential)).google)
                  }
                  onDisconnect={() =>
                    change(async () => {
                      await disconnectGoogle();
                      return null;
                    })
                  }
                  onError={() =>
                    setError(
                      "Couldn’t load Google sign-in. Check your connection and reload.",
                    )
                  }
                />
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** The username and Change, which opens one field with Save and Cancel in place. */
function UsernameRow({
  me,
  onRenamed,
}: {
  me: Me;
  onRenamed: (me: Me) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing)
    return (
      <UsernameForm
        username={me.username}
        onSaved={(renamed) => {
          saveSession({ token: getToken(), username: renamed.username });
          onRenamed(renamed);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );

  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <p className="min-w-0 break-words">{me.username}</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`shrink-0 ${buttonSecondary}`}
      >
        Change
      </button>
    </div>
  );
}

// Its own component so Cancel drops what was typed and any error with it.
function UsernameForm({
  username,
  onSaved,
  onCancel,
}: {
  username: string;
  onSaved: (me: Me) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(username);
  const { errors, failed, saving, save } = useSave({ username: "" });

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(async () => onSaved(await renameUser(name)));
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <Field
        label="Username"
        labelClass="sr-only"
        errors={errors.username}
        className="max-w-[400px]"
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="username"
          autoFocus
          required
          maxLength={150}
          aria-invalid={!!errors.username}
          className={input(!!errors.username)}
        />
      </Field>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-loss">
          Couldn’t save. Check your connection and try again.
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={buttonPrimary}>
          Save
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function GoogleRow({
  me,
  saving,
  onConnect,
  onDisconnect,
  onError,
}: {
  me: Me;
  saving: boolean;
  onConnect: (credential: string) => void;
  onDisconnect: () => void;
  onError: () => void;
}) {
  if (me.google)
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="min-w-0 break-words">
          Connected as <span className="font-medium">{me.google.email}</span>
        </p>
        {me.has_password ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={saving}
            className={`shrink-0 ${buttonSecondary}`}
          >
            Disconnect
          </button>
        ) : (
          <p className="w-full text-[13px] leading-[18px] text-muted">
            This account signs in only with Google, so it stays connected.
          </p>
        )}
      </div>
    );

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <p className="font-medium">Not connected</p>
        {googleClientId() && (
          <p className="text-[13px] leading-[18px] text-muted">
            Connect your Google account to sign in with it too.
          </p>
        )}
      </div>
      {googleClientId() && (
        <div className="max-w-[400px]">
          <GoogleButton onCredential={onConnect} onError={onError} />
        </div>
      )}
    </div>
  );
}
