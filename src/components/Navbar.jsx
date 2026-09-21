import React, { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: "Products", href: "#products" },
    { name: "Locations", href: "#locations" },
    { name: "Career", href: "#career" },
    { name: "Contact Us", href: "#contact" },
  ];

  return (
    <nav
      className="
        fixed top-0 left-0 right-0 z-50
        h-[82px]
        bg-[#11141c]
        border-t-2 border-[#484b50]
      "
    >
      <div
        className="
          max-w-[1192px]
          h-full
          mx-auto
          px-6
          flex
          items-center
          justify-between
        "
      >
        {/* Logo */}
        <a
          href="#"
          className="
            text-[20px]
            font-bold
            tracking-[-0.7px]
            leading-none
            text-[#f2f2f3]
            no-underline
          "
        >
          NEXT <span className="text-[#e7bfc0]">INC.</span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="
                text-[16px]
                font-normal
                text-[#e4c9ca]
                hover:text-white
                transition-colors
                duration-200
              "
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            md:hidden
            p-2
            text-[#e4c9ca]
            hover:text-white
            transition-colors
          "
          aria-label="Toggle navigation"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div
          className="
            md:hidden
            bg-[#11141c]
            border-t border-[#1d2028]
            border-b border-[#2a2d34]
            px-6
            py-3
          "
        >
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="
                block
                py-4
                text-[15px]
                text-[#e4c9ca]
                hover:text-white
                border-b
                border-[#24272e]
                last:border-b-0
                transition-colors
              "
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
