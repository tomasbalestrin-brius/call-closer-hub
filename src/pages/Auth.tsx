import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import logo from '@/assets/logo-bethel-closer.png';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');

const companyValues = [
  "Você veio pra ser mais.",
  "Nosso propósito de vida é realizado com o trabalho.",
  "Não nos pergunte se fomos capazes, nos dê a missão.",
  "Nossa liderança inspira confiança e ação.",
  "Superamos expectativas e alcançamos resultados acima da média.",
  "Sempre gratos, porém insatisfeitos!",
  "Assumimos a responsabilidade e agimos rapidamente para resolver qualquer desafio.",
  "Nosso ambiente é de frequência elevada, inspirando alta performance e crescimento contínuo."
];

const getDailyValue = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return companyValues[dayOfYear % companyValues.length];
};

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyValue] = useState(getDailyValue());
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
    } else {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Bethel Closer" className="w-14 h-14 object-contain" />
            <h1 className="text-3xl font-display font-bold">Bethel Closer</h1>
          </div>
          <h2 className="text-3xl font-display font-bold mb-4 leading-tight">
            Transformando o empreendedorismo através da Educação e Tecnologia.
          </h2>
          <p className="text-xl opacity-90 mb-6">
            E transformar cada empresa em Casa de Deus.
          </p>
          <div className="mt-8 p-4 border border-white/20 rounded-lg bg-white/5">
            <p className="text-sm opacity-70 mb-1">Valor do dia</p>
            <p className="text-lg font-semibold italic">"{dailyValue}"</p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md shadow-card border-border/50 animate-scale-in">
          <CardHeader className="text-center">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <img src={logo} alt="Bethel Closer" className="w-10 h-10 object-contain" />
              <span className="text-xl font-display font-bold">Bethel Closer</span>
            </div>
            <CardTitle className="text-2xl font-display">Bem-vindo</CardTitle>
            <CardDescription>
              Entre na sua conta ou crie uma nova para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Login Only - No self-signup */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full gradient-primary" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Não tem uma conta? Fale com seu administrador.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
