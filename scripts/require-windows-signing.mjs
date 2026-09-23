import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const certificateLink = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
const hasPassword = Object.hasOwn(process.env, 'WIN_CSC_KEY_PASSWORD')
  || Object.hasOwn(process.env, 'CSC_KEY_PASSWORD');

if (!certificateLink) {
  console.error('Windows signing requires WIN_CSC_LINK (or CSC_LINK) pointing to a PFX/P12 certificate.');
  process.exit(1);
}

if (!hasPassword) {
  console.error('Windows signing requires WIN_CSC_KEY_PASSWORD (or CSC_KEY_PASSWORD). Set it to an empty value if the certificate has no password.');
  process.exit(1);
}

if (certificateLink.startsWith('file://')) {
  let certificatePath;
  try {
    certificatePath = fileURLToPath(certificateLink);
  } catch {
    console.error('The configured Windows signing certificate file URL is invalid.');
    process.exit(1);
  }
  if (!existsSync(certificatePath)) {
    console.error('The configured Windows signing certificate file was not found.');
    process.exit(1);
  }
} else if (!/^https?:\/\//i.test(certificateLink) && !/^[A-Za-z0-9+/]+=*$/.test(certificateLink) && !existsSync(certificateLink)) {
  console.error('The configured Windows signing certificate file was not found.');
  process.exit(1);
}

console.log('Windows signing configuration detected.');
