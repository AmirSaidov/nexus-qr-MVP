import { useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import illustration from "@/assets/login-illustration.png";

interface LoginScreenProps {
  onLogin: (payload: { email: string; password: string }) => void | Promise<void>;
  onRegister: () => void;
  onForgot: () => void;
}

export const LoginScreen = ({ onLogin, onRegister, onForgot }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onLogin({ email, password });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6 pt-8 pb-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Вход в систему
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Войдите, чтобы занять место
          <br /> рабочее место
        </p>
      </header>

      <div className="flex justify-center my-6">
        <img
          src={illustration}
          alt="Иллюстрация рабочего места"
          width={220}
          height={220}
          loading="lazy"
          className="w-44 h-44 object-contain"
        />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
        <label className="relative block">
          <span className="sr-only">Email</span>
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-secondary border border-transparent focus:border-primary focus:bg-background outline-none text-sm transition-colors"
          />
        </label>

        <label className="relative block">
          <span className="sr-only">Пароль</span>
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={showPwd ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-12 pl-11 pr-11 rounded-xl bg-secondary border border-transparent focus:border-primary focus:bg-background outline-none text-sm transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label="Показать пароль"
          >
            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 mt-3 rounded-xl text-base font-semibold shadow-button"
        >
          Войти
        </Button>
        <button
          type="button"
          onClick={onForgot}
          className="text-xs text-primary self-center hover:underline mt-1"
        >
          Забыли пароль?
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <button onClick={onRegister} className="text-primary font-semibold hover:underline">
          Регистрация
        </button>
      </p>
    </div>
  );
};
