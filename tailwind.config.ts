import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // Wrap every Tailwind `hover:` utility in `@media (hover: hover)` so
  // hover styles only apply on devices that actually support hover
  // (= desktops with a mouse). On touchscreens, `hover:` rules are
  // ignored entirely — fixes the iOS Safari "sticky hover" where a
  // button stays highlighted bright turquoise after a tap because
  // Safari preserves the :hover state until the user taps somewhere
  // else. This is the official Tailwind-recommended fix; safe and
  // fully backward-compatible (no visual change on desktop).
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        emotions: {
          DEFAULT: 'hsl(var(--emotions))',
          secondary: 'hsl(var(--emotions-secondary))'
        },
        body: {
          DEFAULT: 'hsl(var(--body))',
          secondary: 'hsl(var(--body-secondary))'
        },
        connections: {
          DEFAULT: 'hsl(var(--connections))',
          secondary: 'hsl(var(--connections-secondary))'
        },
        voice: {
          DEFAULT: 'hsl(var(--voice))',
          secondary: 'hsl(var(--voice-secondary))'
        },
        health: {
          DEFAULT: 'hsl(var(--health))',
          secondary: 'hsl(var(--health-secondary))'
        },
        curious: {
          DEFAULT: 'hsl(var(--curious))',
          secondary: 'hsl(var(--curious-secondary))'
        },
        fun: {
          DEFAULT: 'hsl(var(--fun))',
          secondary: 'hsl(var(--fun-secondary))'
        },
        social: {
          DEFAULT: 'hsl(var(--social))',
          secondary: 'hsl(var(--social-secondary))'
        },
        mood: {
          DEFAULT: 'hsl(var(--mood))',
          foreground: 'hsl(var(--mood-foreground))',
          secondary: 'hsl(var(--mood-secondary))'
        },
        relationships: {
          DEFAULT: 'hsl(var(--relationships))',
          foreground: 'hsl(var(--relationships-foreground))',
          secondary: 'hsl(var(--relationships-secondary))'
        },
        work: {
          DEFAULT: 'hsl(var(--work))',
          foreground: 'hsl(var(--work-foreground))',
          secondary: 'hsl(var(--work-secondary))'
        },
        custom: {
          DEFAULT: 'hsl(var(--custom))',
          foreground: 'hsl(var(--custom-foreground))',
          secondary: 'hsl(var(--custom-secondary))'
        },
        balanced: {
          DEFAULT: 'hsl(var(--balanced))',
          foreground: 'hsl(var(--balanced-foreground))'
        },
        emerging: {
          DEFAULT: 'hsl(var(--emerging))',
          foreground: 'hsl(var(--emerging-foreground))'
        },
        strong: {
          DEFAULT: 'hsl(var(--strong))',
          foreground: 'hsl(var(--strong-foreground))'
        },
        untracked: {
          DEFAULT: 'hsl(var(--untracked))',
          foreground: 'hsl(var(--untracked-foreground))'
        },
        note: 'hsl(var(--note))',
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        '2xl': '1.5rem',
        '3xl': '2rem'
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        playful: ['Nunito', 'DM Sans', 'sans-serif']
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
