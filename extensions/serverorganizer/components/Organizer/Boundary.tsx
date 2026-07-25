import React from 'react';

interface State {
    failed: boolean;
}

/**
 * Biztonsagi halo a szervezo kore.
 *
 * A szervezo CSS-sel elrejti a panel sajat szerverlistajat. Ha a szervezo
 * barmilyen okbol hibara fut, a felhasznalo ures oldalt latna - a sajat listaja
 * rejtve, a mienk pedig ossszeomlott. Ez a hataroló ilyenkor leveszi az elrejto
 * osztalyt, es semmit nem rajzol: visszajon az alapertelmezett lista.
 *
 * Rosszabb egy hibas szervezo, mint egy csunya lista. Elerhetetlen panel a
 * legrosszabb.
 */
export default class OrganizerBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: unknown, info: unknown) {
        // eslint-disable-next-line no-console
        console.error('[ServerOrganizer] hiba - visszaall az alapertelmezett szerverlista', error, info);

        try {
            document.body.classList.remove('so-active');
        } catch (removalError) {
            /* ha meg ez sem megy, mar ugysem tudunk mit tenni */
        }
    }

    render() {
        if (this.state.failed) {
            return null;
        }

        return <>{this.props.children}</>;
    }
}
