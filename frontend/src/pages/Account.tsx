import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ApiError,
  askForResetLink,
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
const hint = "mt-3 text-[13px] leading-[18px] text-muted";

/** Your username, the ways you log in (password and Google) and your recovery email
 * (`/account`). */
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
        <Skeleton label="Loading your account" className="mt-8 sm:mt-12">
          <Bone className="h-7 w-24" />
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

      {typeof me === "object" &&
        (me.is_demo ? (
          <p className={`mt-8 sm:mt-12 ${section}`}>
            This is a demo account, so its settings can’t be changed. Sign up to
            get your own.
          </p>
        ) : (
          <>
            <Section title="Username" className="mt-8 sm:mt-12">
              <UsernameRow me={me} onRenamed={setMe} />
            </Section>

            <Section title="Ways to log in" className="mt-8">
              {error && (
                <p
                  role="alert"
                  className="mt-3 text-[13px] leading-[18px] text-loss"
                >
                  {error}
                </p>
              )}
              <PasswordRow me={me} onError={setError} />
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
                    "Couldn’t load Google’s button. Check your connection and reload.",
                  )
                }
              />
              <p className={hint}>
                {me.has_password
                  ? "Keep at least one way to log in."
                  : `Google is your only way to log in, so it stays connected.${
                      me.email ? "" : " Add a recovery email to set a password."
                    }`}
              </p>
            </Section>

            <Section title="Recovery email" className="mt-8">
              <EmailRow me={me} />
            </Section>
          </>
        ))}
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

/** One line of a section: what's true on the left, its action (if any) on the right. */
function Row({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-4">
      <div className="min-w-0 break-words">{children}</div>
      {action}
    </div>
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
    <Row action={<ChangeButton onClick={() => setEditing(true)} />}>
      {me.username}
    </Row>
  );
}

function ChangeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 ${buttonSecondary}`}
    >
      Change
    </button>
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

/** The email and Change, or "No recovery email yet." and Add email; either opens one field.
 * Nothing changes until the emailed link is opened, so sending only says where it went. */
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
          We sent a link to <span className="font-medium">{sentTo}</span>. Open
          it within 24 hours to confirm. Not there? Check your spam folder.
        </p>
      )}
      {me.email ? (
        <Row action={<ChangeButton onClick={open} />}>{me.email}</Row>
      ) : (
        <p className="mt-3">No recovery email yet.</p>
      )}
      {/* Without a password there's nothing to reset, only a username to find. */}
      <p className={hint}>
        {me.has_password
          ? "Used if you forget your username or password."
          : "Used if you forget your username."}
      </p>
      {!me.email && (
        <button
          type="button"
          onClick={open}
          className={`mt-3 ${buttonSecondary}`}
        >
          Add email
        </button>
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

/** "Password" and Change, which opens Current and New password. An account that logs in
 * only with Google has "Not set" and Set password, which emails it the reset link (the
 * link proves the recovery email, docs/specs/google-only-password.md). */
function PasswordRow({
  me,
  onError,
}: {
  me: Me;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [changed, setChanged] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendLink() {
    setSending(true);
    setSent(false);
    onError("");
    try {
      await askForResetLink(me.email);
      setSent(true);
    } catch (err) {
      onError(generalError(err, {}));
    }
    setSending(false);
  }

  if (!me.has_password)
    return (
      <>
        {sent && (
          <p role="status" className="mt-3">
            We sent a link to <span className="font-medium">{me.email}</span>.
            Open it within 1 hour to set your password. Not there? Check your
            spam folder.
          </p>
        )}
        <Row
          action={
            me.email ? (
              <button
                type="button"
                onClick={sendLink}
                disabled={sending}
                className={`shrink-0 ${buttonSecondary}`}
              >
                Set password
              </button>
            ) : null
          }
        >
          <p className="font-medium">Password</p>
          <p className="text-muted">Not set</p>
        </Row>
      </>
    );

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
          <span className="font-medium">Password changed.</span> You’re logged
          out on your other devices.
        </p>
      )}
      <Row
        action={
          <ChangeButton
            onClick={() => {
              setChanged(false);
              setEditing(true);
            }}
          />
        }
      >
        <p className="font-medium">Password</p>
      </Row>
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
  // Disconnect only when the password is left to log in with.
  const disconnect = me.google && me.has_password && (
    <button
      type="button"
      onClick={onDisconnect}
      disabled={saving}
      className={`shrink-0 ${buttonSecondary}`}
    >
      Disconnect
    </button>
  );

  return (
    <>
      <Row action={disconnect}>
        <p className="font-medium">Google</p>
        <p className="text-muted">{me.google?.email ?? "Not connected"}</p>
      </Row>
      {!me.google && googleClientId() && (
        <div className="mt-3 max-w-[400px]">
          <GoogleButton onCredential={onConnect} onError={onError} />
        </div>
      )}
    </>
  );
}
