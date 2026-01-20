export const diacriticSensitiveRegex = (string = "") => {
  return string
    .replace(/a/g, "[a,á,à,ä]")
    .replace(/e/g, "[e,é,ë]")
    .replace(/i/g, "[i,í,ï]")
    .replace(/o/g, "[o,ó,ö,ò]")
    .replace(/u/g, "[u,ü,ú,ù]");
};

// Normaliza texto removendo acentos e convertendo para minúsculo
export const normalizeText = (string = "") => {
  return string
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const onlyNumbers = (string = "") => {
  return string.replace(/[^\d]+/g, "");
};
