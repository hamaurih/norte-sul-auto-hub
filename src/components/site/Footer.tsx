import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-secondary text-secondary-foreground">
      <div className="container-x grid gap-8 py-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-lg font-black text-primary-foreground">NS</div>
            <div>
              <div className="font-display text-lg font-bold uppercase leading-none">Norte Sul</div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">Acessórios Automotivos</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/70">
            Som, iluminação, performance e segurança para todo tipo de carro. Atacado e varejo com entrega em todo o Brasil.
          </p>
        </div>

        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Institucional</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link to="/" className="hover:text-primary">Sobre a Norte Sul</Link></li>
            <li><Link to="/b2b" className="hover:text-primary">Compre no Atacado</Link></li>
            <li><Link to="/" className="hover:text-primary">Política de Privacidade</Link></li>
            <li><Link to="/" className="hover:text-primary">Trocas e Devoluções</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Atendimento</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> (00) 0000-0000</li>
            <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp comercial</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contato@nortesul.com.br</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Seg a Sex, 8h-18h</li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-display text-sm font-bold uppercase tracking-wider">Pagamento</h4>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase text-white/80">
            <span className="rounded bg-white/10 px-2 py-1">PIX</span>
            <span className="rounded bg-white/10 px-2 py-1">Visa</span>
            <span className="rounded bg-white/10 px-2 py-1">Master</span>
            <span className="rounded bg-white/10 px-2 py-1">Elo</span>
            <span className="rounded bg-white/10 px-2 py-1">Boleto</span>
            <span className="rounded bg-white/10 px-2 py-1">B2B 28d</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/40 py-3 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Norte Sul Acessórios · CNPJ 00.000.000/0001-00 · Todos os direitos reservados
      </div>
    </footer>
  );
}
