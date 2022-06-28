import { X509Certificate } from "crypto";

import { GREEN, BLUE } from "./constants";

export default function prettyCert(cert: X509Certificate, path: string) {
  console.group(GREEN, cert.subject);
  console.log(BLUE, "Vault Location", path);
  if (cert.subjectAltName) {
    console.log(BLUE, "Subject Alt Name", cert.subjectAltName);
  }

  console.log(BLUE, "Issuer", cert.issuer);

  if (cert.infoAccess) {
    console.log(BLUE, "Info Access", cert.infoAccess.trim());
  }
  console.log(BLUE, "Valid From", cert.validFrom);
  console.log(BLUE, "Valid To", cert.validTo);
  console.log(BLUE, "Serial Number", cert.serialNumber);
  console.log("----------");
  console.groupEnd();
}
