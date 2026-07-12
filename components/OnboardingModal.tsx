'use client';

import { ICONS } from '@/components/NavButton';
import RarityIcon from '@/components/RarityIcon';
import { RARITY_TIERS } from '@/lib/rarity';

// Telinha de boas-vindas exibida uma única vez (flag em localStorage).
// Explica o loop do jogo: nascer -> colecionar -> raridades -> desafio diário.
export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop modal-backdrop--open onboarding-backdrop">
      <div className="modal-panel onboarding">
        <h2 className="onboarding__title">Bem-vindo ao DropLife Brasil!</h2>

        <div className="onboarding__steps">
          <div className="onboarding__step">
            <span className="onboarding__icon">{ICONS.citydex}</span>
            <p>
              Aperte <strong>NASCER</strong> e o destino sorteia um dos <strong>5.570 municípios</strong>{' '}
              do Brasil — quanto mais gente mora lá, maior a chance de nascer lá, como na vida real.
            </p>
          </div>
          <div className="onboarding__step">
            <span className="onboarding__icon onboarding__icon--medals">
              {RARITY_TIERS.map((t) => (
                <RarityIcon key={t.id} tier={t.id} />
              ))}
            </span>
            <p>
              Cidade pequena = <strong>rara</strong>. Cada município tem uma raridade: Comum,
              Incomum, Raro, Épico e <strong>Lendário</strong> (menos de 1% de chance!). Colecione
              todas na sua <strong>Citydex</strong>.
            </p>
          </div>
          <div className="onboarding__step">
            <span className="onboarding__icon">{ICONS.desafio}</span>
            <p>
              No <strong>Desafio Diário</strong>, todo mundo recebe a mesma cidade sorteada — o jogo
              diz o <strong>nome e o estado</strong> dela e dá zoom lá. Você{' '}
              <strong>clica no mapa onde acha que ela fica</strong> e descobre se acertou!
            </p>
          </div>
          <div className="onboarding__step">
            <span className="onboarding__icon">{ICONS.ranking}</span>
            <p>
              Crie uma conta (opcional) para entrar no <strong>ranking global</strong> e disputar
              quem coleciona mais cidades.
            </p>
          </div>
        </div>

        <button className="onboarding__cta" type="button" onClick={onClose}>
          Quero nascer!
        </button>
      </div>
    </div>
  );
}
