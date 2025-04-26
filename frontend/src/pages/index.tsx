'use client';

import Link from "next/link";
import { Box, Button, Container, Typography } from "@mui/material";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <Box
      sx={{
        position: "fixed", 
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(to right, #1f1f1f, #434343)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Hero Section */}
      <Container
        maxWidth="sm"
        sx={{
          mt: "auto",
          mb: "auto",
          textAlign: "center",
          backgroundColor: "rgba(255,255,255,0.95)",
          py: 8,
          px: 4,
          borderRadius: 4,
          boxShadow: 6,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Typography
            variant="h3"
            fontWeight="bold"
            gutterBottom
            color="primary"
          >
            🎼 ACME Music Licensing
          </Typography>

          <Typography
            variant="h5"
            color="text.secondary"
            fontWeight="bold"
            gutterBottom
          >
            Manage your movie music licenses in real time.
          </Typography>

          <Button
            component={Link}
            href="/dashboard"
            variant="contained"
            size="large"
            color="secondary"
            sx={{
              mt: 4,
              fontWeight: "bold",
              borderRadius: 3,
              px: 6,
              py: 1.5,
            }}
          >
            <Typography variant="h6">Enter</Typography>
          </Button>
        </motion.div>
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: "center",
          color: "white",
          fontSize: "1.7rem",
        }}
      >
        Developed by{" "}
        <Link
          href="https://github.com/AlanGarcilazo"
          target="_blank"
          style={{ color: "#90caf9", textDecoration: "none" }}
        >
          <Typography variant="h5" fontWeight="bold" component="span">
            Alan Garcilazo
          </Typography>
        </Link>
      </Box>
    </Box>
  );
}
