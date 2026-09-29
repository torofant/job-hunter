export type KnownProvince =
  | "CASTELLON"
  | "VALENCIA"
  | "OTHER"
  | "UNKNOWN";

function normalizeCityName(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

const CITY_TO_PROVINCE = new Map<string, KnownProvince>();

function addCities(province: KnownProvince, cities: string[]): void {
  for (const city of cities) {
    CITY_TO_PROVINCE.set(normalizeCityName(city), province);
  }
}

addCities("CASTELLON", [
  "Castellón de la Plana",
  "Castellon de la Plana",
  "Vila-real",
  "Villarreal",
  "Borriana",
  "Burriana",
  "Vall d'Uixó",
  "Vall d'Uixo",
  "Benicarló",
  "Benicarlo",
  "Vinaròs",
  "Vinaros",
  "Onda",
  "Almassora",
  "Oropesa del Mar",
  "Orpesa",
  "Benicàssim",
  "Benicassim",
  "Segorbe",
  "Nules",
  "L'Alcora",
  "Alcora",
  "Moncofa",
  "Peñíscola",
  "Peniscola",
  "Almenara",
  "Betxí",
  "Betxi",
  "Xilxes",
  "Chilches",
  "Torreblanca",
  "Alcalà de Xivert",
  "Alcala de Xivert",
]);

addCities("VALENCIA", [
  "Valencia",
  "València",
  "Torrent",
  "Gandia",
  "Paterna",
  "Sagunto",
  "Sagunt",
  "Alzira",
  "Mislata",
  "Burjassot",
  "Aldaia",
  "Manises",
  "Xirivella",
  "Quart de Poblet",
  "Catarroja",
  "Paiporta",
  "Picassent",
  "Puçol",
  "Pucol",
  "La Pobla de Vallbona",
  "Llíria",
  "Lliria",
  "Riba-roja de Túria",
  "Riba-roja de Turia",
  "Ontinyent",
  "Xàtiva",
  "Xativa",
  "Sueca",
  "Cullera",
  "Carcaixent",
  "Algemesí",
  "Algemesi",
  "Oliva",
]);

addCities("OTHER", [
  // Albacete
  "Albacete",
  "Hellín",
  "Hellin",
  "Almansa",
  "Villarrobledo",

  // Alicante
  "Alicante",
  "Alacant",
  "Elche",
  "Elx",
  "Benidorm",
  "Torrevieja",
  "Alcoy",
  "Alcoi",
  "Orihuela",
  "Elda",
  "Dénia",
  "Denia",

  // Almería
  "Almería",
  "Almeria",
  "Roquetas de Mar",
  "El Ejido",
  "Níjar",
  "Nijar",

  // Álava
  "Vitoria-Gasteiz",
  "Llodio",
  "Amurrio",

  // Asturias
  "Oviedo",
  "Gijón",
  "Gijon",
  "Avilés",
  "Aviles",
  "Langreo",

  // Ávila
  "Ávila",
  "Avila",
  "Arévalo",
  "Arevalo",
  "Arenas de San Pedro",

  // Badajoz
  "Badajoz",
  "Mérida",
  "Merida",
  "Don Benito",
  "Almendralejo",

  // Baleares
  "Palma",
  "Calvià",
  "Calvia",
  "Manacor",
  "Ibiza",

  // Barcelona
  "Barcelona",
  "L'Hospitalet de Llobregat",
  "Hospitalet de Llobregat",
  "Badalona",
  "Sabadell",
  "Terrassa",
  "Mataró",
  "Mataro",

  // Burgos
  "Burgos",
  "Aranda de Duero",
  "Miranda de Ebro",

  // Cáceres
  "Cáceres",
  "Caceres",
  "Plasencia",
  "Navalmoral de la Mata",
  "Coria",

  // Cádiz
  "Cádiz",
  "Cadiz",
  "Jerez de la Frontera",
  "Algeciras",
  "El Puerto de Santa María",
  "El Puerto de Santa Maria",

  // Ciudad Real
  "Ciudad Real",
  "Puertollano",
  "Tomelloso",
  "Alcázar de San Juan",
  "Alcazar de San Juan",

  // Córdoba
  "Córdoba",
  "Cordoba",
  "Lucena",
  "Puente Genil",
  "Montilla",

  // A Coruña
  "A Coruña",
  "A Coruna",
  "Santiago de Compostela",
  "Ferrol",
  "Oleiros",

  // Cuenca
  "Cuenca",
  "Tarancón",
  "Tarancon",
  "San Clemente",

  // Girona
  "Girona",
  "Figueres",
  "Blanes",
  "Lloret de Mar",

  // Granada
  "Granada",
  "Motril",
  "Armilla",
  "Maracena",

  // Guadalajara
  "Guadalajara",
  "Azuqueca de Henares",
  "Cabanillas del Campo",
  "Alovera",

  // Gipuzkoa
  "Donostia-San Sebastián",
  "Donostia-San Sebastian",
  "San Sebastián",
  "San Sebastian",
  "Irun",
  "Errenteria",
  "Eibar",

  // Huelva
  "Huelva",
  "Lepe",
  "Almonte",
  "Isla Cristina",

  // Huesca
  "Huesca",
  "Monzón",
  "Monzon",
  "Barbastro",

  // Jaén
  "Jaén",
  "Jaen",
  "Linares",
  "Andújar",
  "Andujar",
  "Úbeda",
  "Ubeda",

  // León
  "León",
  "Leon",
  "Ponferrada",
  "San Andrés del Rabanedo",
  "San Andres del Rabanedo",
  "Villaquilambre",

  // Lleida
  "Lleida",
  "Balaguer",
  "Tàrrega",
  "Tarrega",
  "Mollerussa",

  // La Rioja
  "Logroño",
  "Logrono",
  "Calahorra",
  "Arnedo",
  "Haro",

  // Lugo
  "Lugo",
  "Monforte de Lemos",
  "Viveiro",

  // Madrid
  "Madrid",
  "Móstoles",
  "Mostoles",
  "Alcalá de Henares",
  "Alcala de Henares",
  "Fuenlabrada",
  "Leganés",
  "Leganes",
  "Getafe",
  "Alcobendas",
  "Pozuelo de Alarcón",
  "Pozuelo de Alarcon",
  "Las Rozas",
  "Majadahonda",

  // Málaga
  "Málaga",
  "Malaga",
  "Marbella",
  "Mijas",
  "Fuengirola",

  // Murcia
  "Murcia",
  "Cartagena",
  "Lorca",
  "Molina de Segura",

  // Navarra
  "Pamplona",
  "Tudela",
  "Barañáin",
  "Baranain",
  "Estella-Lizarra",

  // Ourense
  "Ourense",
  "Verín",
  "Verin",
  "O Barco de Valdeorras",

  // Palencia
  "Palencia",
  "Aguilar de Campoo",
  "Guardo",

  // Las Palmas
  "Las Palmas de Gran Canaria",
  "Telde",
  "Santa Lucía de Tirajana",
  "Santa Lucia de Tirajana",
  "Arrecife",

  // Pontevedra
  "Vigo",
  "Pontevedra",
  "Vilagarcía de Arousa",
  "Vilagarcia de Arousa",
  "Redondela",

  // Salamanca
  "Salamanca",
  "Santa Marta de Tormes",
  "Béjar",
  "Bejar",
  "Ciudad Rodrigo",

  // Santa Cruz de Tenerife
  "Santa Cruz de Tenerife",
  "San Cristóbal de La Laguna",
  "San Cristobal de La Laguna",
  "Arona",
  "Adeje",

  // Cantabria
  "Santander",
  "Torrelavega",
  "Castro-Urdiales",
  "Camargo",

  // Segovia
  "Segovia",
  "Cuéllar",
  "Cuellar",
  "El Espinar",

  // Sevilla
  "Sevilla",
  "Dos Hermanas",
  "Alcalá de Guadaíra",
  "Alcala de Guadaira",
  "Utrera",

  // Soria
  "Soria",
  "Almazán",
  "Almazan",
  "Ólvega",
  "Olvega",

  // Tarragona
  "Tarragona",
  "Reus",
  "Tortosa",
  "Cambrils",

  // Teruel
  "Teruel",
  "Alcañiz",
  "Alcaniz",
  "Andorra",

  // Toledo
  "Toledo",
  "Talavera de la Reina",
  "Illescas",
  "Seseña",
  "Sesena",

  // Valladolid
  "Valladolid",
  "Laguna de Duero",
  "Arroyo de la Encomienda",
  "Medina del Campo",

  // Bizkaia
  "Bilbao",
  "Barakaldo",
  "Getxo",
  "Portugalete",

  // Zamora
  "Zamora",
  "Benavente",
  "Toro",

  // Zaragoza
  "Zaragoza",
  "Calatayud",
  "Ejea de los Caballeros",
  "Utebo",
]);

export function getCityProvince(city: string | null): KnownProvince {
  if (!city || city.trim() === "") {
    return "UNKNOWN";
  }

  const normalizedCity = normalizeCityName(city);

  return CITY_TO_PROVINCE.get(normalizedCity) ?? "UNKNOWN";
}