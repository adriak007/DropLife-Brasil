export const ufToName: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapa', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceara',
  DF: 'Distrito Federal', ES: 'Espirito Santo', GO: 'Goias', MA: 'Maranhao',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Para',
  PB: 'Paraiba', PR: 'Parana', PE: 'Pernambuco', PI: 'Piaui', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondonia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'Sao Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

// Nomes no SVG que divergem do IBGE (renomeações, grafias antigas)
export const cityAliases = new Map<string, string>([
  ['saoluiz-rr', 'Sao Luis'],
  ['santaisabeldopara-pa', 'Santa Izabel do Para'],
  ['coutomagalhaes-to', 'Couto de Magalhaes'],
  ['itapage-ce', 'Itapaje'],
  ['acu-rn', 'Assu'],
  ['ares-rn', 'Arez'],
  ['augustosevero-rn', 'Campo Grande'],
  ['januariocicco-rn', 'Boa Saude'],
  ['presidentejuscelino-rn', 'Serra Caiada'],
  ['santarem-pb', 'Joca Claudino'],
  ['serido-pb', 'Sao Vicente do Serido'],
  ['campodesantana-pb', 'Tacima'],
  ['belemdesaofrancisco-pe', 'Belem do Sao Francisco'],
  ['iguaraci-pe', 'Iguaracy'],
  ['lagoadoitaenga-pe', 'Lagoa de Itaenga'],
  ['saocaitano-pe', 'Sao Caetano'],
  ['fernandodenoronha-pe', 'Fernando de Noronha'],
  ['lajedodotabocal-ba', 'Lagedo do Tabocal'],
  ['muquemdesaofrancisco-ba', 'Muquem do Sao Francisco'],
  ['amparodesaofrancisco-se', 'Amparo do Sao Francisco'],
  ['grachocardoso-se', 'Graccho Cardoso'],
  ['santaluziadoitanhy-se', 'Santa Luzia do Itanhi'],
  ['amparodoserra-mg', 'Amparo da Serra'],
  ['brasopolis-mg', 'Brazopolis'],
  ['donausebia-mg', 'Dona Euzebia'],
  ['donaeusbia-mg', 'Dona Euzebia'],
  ['donaeusebia-mg', 'Dona Euzebia'],
  ['majorisidoro-al', 'Major Izidoro'],
  ['saothomedasletras-mg', 'Sao Tome das Letras'],
  ['embu-sp', 'Embu das Artes'],
  ['florinia-sp', 'Florinea'],
  ['luisantonio-sp', 'Luiz Antonio'],
  ['mojimirim-sp', 'Mogi Mirim'],
  ['saoluisdoparaitinga-sp', 'Sao Luiz do Paraitinga'],
  ['munhozdemelo-pr', 'Munhoz de Mello'],
  ['poxoreo-mt', 'Poxoreu'],
  ['santoantoniodoleverger-mt', 'Santo Antonio de Leverger'],
  ['senadorjoseporfirio-pa', 'Senador Jose Porfirio'],
]);

export const stateLabelOffsets: Record<string, { x: number; y: number }> = {
  PE: { x: -8, y: 32 },
  SC: { x: 10, y: -5 },
};

export const stateLabelText = (stateKey = ''): string => {
  if (!stateKey) return '';
  if (/^[A-Z]{2}$/.test(stateKey)) return stateKey;
  return stateKey
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
};

export const CURIOSITY_SOURCES = Object.keys(ufToName).map(
  (uf) => `/Curiosidades/${uf}_curiosidades.json`
);
