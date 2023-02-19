import { render } from "solid-js/web";
import { useI18n } from "@solid-primitives/i18n";
const Footer = () => {
  const [t, { add, locale, dict }] = useI18n();
  return <footer>{t("footer")}</footer>;
};
export default Footer;
