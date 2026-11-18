import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ApiError,
  changePassword,
  connectGoogle,
  disconnectGoogle,
  generalError,
  getMe,
  renameUser,
  sendEmailLink,
  type Me,
} from "../api";
import { updateSession } from "../auth";
import { Field, useSave } from "../components/form";
import { Bone, Skeleton } from "../components/Skeleton";
import { GoogleButton, googleClientId } from "../google";
import { buttonPrimary, buttonSecondary, input } from "../ui";

const section = "border-t border-line-strong pt-4";
const heading = "font-serif text-[22px] leading-7 font-medium";

/** Who you're logged in as, your username, email and password, and Google (`/account`). */
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
              <Section title="Username" className="mt-8 sm:mt-12">
                <UsernameRow me={me} onRenamed={setMe} />
              </Section>

              <Section title="Email" className="mt-8">
                <EmailRow me={me} />
              </Section>

              <Section title="Password" className="mt-8">
                <PasswordRow me={me} />
              </Section>

              <Section title="Google" className="mt-8">
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
              </Section>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** A hairline, a heading, and what's under it; named by the heading for screen readers. */
function Section({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${className} ${section}`}>
      <h2 id={id} className={heading}>
        {title}
      </h2>
      {children}
    </section>
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
          updateSession({ username: renamed.username });
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
  const { errors, error, failed, saving, save } = useSave({ username: "" });

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
          {generalError(error, {})}
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

/** The email and Change, or a prompt and Add email; either opens one field. Nothing changes
 * until the emailed link is opened, so sending only says where the link went. */
function EmailRow({ me }: { me: Me }) {
  const [editing, setEditing] = useState(false);
  const [sentTo, setSentTo] = useState("");

  if (editing)
    return (
      <EmailForm
        email={me.email}
        onSent={(email) => {
          setSentTo(email);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );

  const open = () => {
    setSentTo("");
    setEditing(true);
  };

  return (
    <>
      {sentTo && (
        <p role="status" className="mt-3">
          We sent a link to <span className="font-medium">{sentTo}</span>. It
          works for 24 hours. If it doesn’t arrive, check your spam folder.
        </p>
      )}
      {me.email ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="min-w-0 break-words">{me.email}</p>
          <button
            type="button"
            onClick={open}
            className={`shrink-0 ${buttonSecondary}`}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p>
            No email yet. Add one so you can get back in if you forget your
            password.
          </p>
          <button type="button" onClick={open} className={buttonSecondary}>
            Add email
          </button>
        </div>
      )}
    </>
  );
}

function EmailForm({
  email,
  onSent,
  onCancel,
}: {
  email: string;
  onSent: (email: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(email);
  const { errors, error, failed, saving, save } = useSave({ email: "" });

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(async () => {
      await sendEmailLink(value);
      onSent(value);
    });
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <Field
        label="Email"
        labelClass="sr-only"
        errors={errors.email}
        className="max-w-[400px]"
      >
        <input
          type="email"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="email"
          autoFocus
          required
          maxLength={254}
          aria-invalid={!!errors.email}
          className={input(!!errors.email)}
        />
      </Field>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] leading-[18px] text-loss">
          {generalError(error, {})}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={buttonPrimary}>
          Send link
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "You log in with a password." and Change, which opens Current and New password. */
function PasswordRow({ me }: { me: Me }) {
  const [editing, setEditing] = useState(false);
  const [changed, setChanged] = useState(false);

  if (!me.has_password) return <p className="mt-3">You log in with Google.</p>;

  if (editing)
    return (
      <PasswordForm
        username={me.username}
        onChanged={(session) => {
          updateSession(session);
          setEditing(false);
          setChanged(true);
        }}
        onCancel={() => setEditing(false)}
      />
    );

  return (
    <>
      {changed && (
        <p role="status" className="mt-3">
          <span className="font-medium">Password changed.</span> Your other
          devices are logged out.
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="min-w-0">You log in with a password.</p>
        <button
          type="button"
          onClick={() => {
            setChanged(false);
            setEditing(true);
          }}
          className={`shrink-0 ${buttonSecondary}`}
        >
          Change
        </button>
      </div>
    </>
  );
}

const PASSWORDS = { current_password: "", new_password: "" };

function PasswordForm({
  username,
  onChanged,
  onCancel,
}: {
  username: string;
  onChanged: (session: { token: string; username: string }) => void;
  onCancel: () => void;
}) {
  const [passwords, setPasswords] = useState(PASSWORDS);
  const { errors, error, failed, saving, save } = useSave(PASSWORDS);

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(async () => onChanged(await changePassword(passwords)));
  }

  const field = (
    name: keyof typeof PASSWORDS,
    label: string,
    autoComplete: string,
  ) => (
    <Field label={label} errors={errors[name]} className="max-w-[400px]">
      <input
        type="password"
        value={passwords[name]}
        onChange={(event) =>
          setPasswords({ ...passwords, [name]: event.target.value })
        }
        autoComplete={autoComplete}
        autoFocus={name === "current_password"}
        required
        aria-invalid={!!errors[name]}
        className={input(!!errors[name])}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-4">
      {/* Tells password managers which saved login the new password is for. */}
      <input hidden readOnly autoComplete="username" value={username} />
      {field("current_password", "Current password", "current-password")}
      {field("new_password", "New password", "new-password")}
      {failed && (
        <p role="alert" className="text-[13px] leading-[18px] text-loss">
          {generalError(error, errors)}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={buttonPrimary}>
          Change password
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
