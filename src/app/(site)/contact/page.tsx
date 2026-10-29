import type { Metadata } from 'next';

import { ContactChannelButtons } from '@/components/site/contact-links';
import { ContactForm } from '@/components/site/contact-form';
import { PageIntro } from '@/components/site/page-intro';
import { Card, DemoBadge, Section } from '@/components/ui/surface';
import { getSettings } from '@/lib/data/queries';

export const metadata: Metadata = {
  title: 'Aloqa',
  description:
    'Samarkhand Hotel bilan bogʻlanish: telefon, email, Telegram va aloqa formasi.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <PageIntro
        eyebrow="Aloqa"
        title="Bogʻlanish"
        description="Savolingiz boʻlsa yozing yoki qoʻngʻiroq qiling. Qabulxona sutkasiga 24 soat ishlaydi."
        crumbs={[{ href: '/contact', label: 'Aloqa' }]}
      />

      <Section tone="ivory" className="pt-10 sm:pt-12">
        <div className="container-content grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div>
            <h2 className="font-display text-2xl text-chocolate-800">
              Toʻgʻridan-toʻgʻri aloqa
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brown-400">
              Faqat sozlangan aloqa kanallari koʻrsatiladi. Bu yerda koʻrinmagan
              kanal hozircha ulanmagan.
            </p>

            <ContactChannelButtons settings={settings} className="mt-5" size="lg" />

            {settings.isDemoData ? (
              <Card tone="sand" className="mt-6 flex flex-wrap items-center gap-3 p-4">
                <DemoBadge />
                <p className="text-sm leading-relaxed text-brown-400">
                  Ushbu telefon raqami va email manzili namuna maʼlumotlar.
                  Ular haqiqiy raqamga ulanmagan va mehmonxona maʼmuri tomonidan
                  almashtirilishi kerak.
                </p>
              </Card>
            ) : null}

            <dl className="mt-8 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-chocolate-800">Kelish va chiqish</dt>
                <dd className="mt-0.5 text-brown-400">
                  Kelish {settings.checkInTime} dan, chiqish {settings.checkOutTime} gacha.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-chocolate-800">Vaqt mintaqasi</dt>
                <dd className="mt-0.5 text-brown-400">{settings.timeZone}</dd>
              </div>
            </dl>
          </div>

          <Card tone="raised" className="p-6 sm:p-7">
            <h2 className="font-display text-2xl text-chocolate-800">Xabar yuborish</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-400">
              Formani toʻldiring — xabaringiz mehmonxona panelida saqlanadi va
              javob beriladi.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
