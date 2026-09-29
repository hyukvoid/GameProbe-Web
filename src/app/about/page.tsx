import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'How this data works' }

export default function AboutPage() {
  return (
    <main id="main">
      <div className="page-head">
        <h1>How this data works</h1>
      </div>
      <div className="form" style={{ gap: 20 }}>
        <section className="first">
          <h2>Two kinds of evidence</h2>
          <p style={{ marginTop: 8 }}>
            A <strong>direct test</strong> is submitted through the <Link href="/submit">test form</Link> by someone who
            played the game with the controller. It records the exact setup they entered and a result for each control
            they tried. Tests are published only after a person reviews them.
          </p>
          <p style={{ marginTop: 8 }}>
            An <strong>external report</strong> was found on another site (a forum post, a video, a thread) and reviewed
            by hand. GameProbe did not test it. It only carries the details the source actually states, and it always
            links to the source.
          </p>
          <p style={{ marginTop: 8 }}>
            The two are counted separately everywhere. When direct tests exist, they decide the result shown for a
            control. External reports alone are shown as “Reported working” or “Reported broken”.
          </p>
        </section>

        <section>
          <h2>What is not counted</h2>
          <ul style={{ marginTop: 8 }}>
            <li>Questions such as “Does DualSense work in Genshin?” are not reports.</li>
            <li>Reposts and copies of the same report count once.</li>
            <li>Submitted tests that haven’t been reviewed yet, or were rejected.</li>
          </ul>
        </section>

        <section>
          <h2>Unknown stays unknown</h2>
          <p style={{ marginTop: 8 }}>
            If a report doesn’t say which game version, Android version, device, connection or exact controller model
            was used, GameProbe shows it as unknown. A source that says “8BitDo Ultimate” is not assumed to mean a
            specific model, and “latest patch” is never turned into a version number.
          </p>
        </section>

        <section>
          <h2>Disagreement is kept</h2>
          <p style={{ marginTop: 8 }}>
            When results differ, the control is shown as conflicting with the count on each side and the conditions
            that differ, for example USB versus Bluetooth. There are no scores or percentages.
          </p>
        </section>

        <section>
          <h2>What is stored about you</h2>
          <p style={{ marginTop: 8 }}>
            Nothing that identifies you. There are no accounts. To limit spam, the server keeps a keyed hash of your
            network address that changes every day; the address itself is not stored. Anything you type in the notes
            field may be published.
          </p>
        </section>

        <section>
          <h2>Image credits</h2>
          <p style={{ marginTop: 8 }}>
            The small game logos in the game lists come from the sources recorded in this site’s code. Two Wikimedia
            Commons files are used under Creative Commons licenses, cropped and resized to a square tile: the Alien:
            Isolation logo by Jesmar under{' '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" rel="noopener noreferrer">
              CC BY-SA 3.0
            </a>
            , and the Brawlhalla logo by Blue Mammoth Games under{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener noreferrer">
              CC BY-SA 4.0
            </a>
            . The other logos are public-domain text logos or come from an official press kit. The Diablo Immortal
            logo comes from Blizzard’s official press center, credited to Blizzard Entertainment as that source
            requires. The large artwork on game pages comes from official press kits too: the Dead Cells key art is
            from Motion Twin’s press kit, credited to Motion Twin, and the Diablo Immortal key art comes from
            Blizzard’s official press center, credited to Blizzard Entertainment. Every other large game-page image,
            and the four small custom tiles used where no reusable third-party logo exists, are{' '}
            <strong>GameProbe original visuals</strong>: abstract, game-associated geometry drawn for this site, with
            no third-party game artwork, characters, logos or screenshots used in them. Game names, logos and
            trademarks belong to their owners; they appear here only to identify the games this reference site
            covers, with no endorsement implied.
          </p>
        </section>
      </div>
    </main>
  )
}
