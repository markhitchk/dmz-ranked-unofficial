import * as Crypto from 'expo-crypto';

const DEV_HASH_SALT_1 = 'DMZRanked::DeveloperGate::Layer1::v1';
const DEV_HASH_SALT_2 = 'HarleysStudios::DeveloperGate::Layer2::v1';
const DEV_PIN_DOUBLE_HASH =
  'af237b066602cebf2ea25843fdab831639173b894205a21192b15c6ac242c23d';

export async function verifyDeveloperPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;

  const firstHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    DEV_HASH_SALT_1 + pin,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  const secondHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    DEV_HASH_SALT_2 + firstHex,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return secondHex.toLowerCase() === DEV_PIN_DOUBLE_HASH;
}
